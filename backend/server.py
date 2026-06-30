import asyncio
import base64
import json
import re
import socket
import traceback
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, File, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from backend.analyzer import analyze_artwork
from backend.dedup import find_existing_artwork
from backend.immersive import generate_immersive
from backend.matcher import match_artist
from backend.narrator import narrate
from backend.profile import build_profile_text, persona_from_tone

load_dotenv()

ROOT = Path(__file__).parent.parent
ANALYSES_DIR = ROOT / "analyses"
ANALYSES_DIR.mkdir(exist_ok=True)

USERS_DIR = ROOT / "users"
USERS_DIR.mkdir(exist_ok=True)

MAX_SCANS = 5  # caps an artist's quest level (mirrors frontend data.ts)


# ─── Base de données par persona (cache partagé, persistant) ──────────────────

def _persona_dir(persona: str) -> Path:
    d = ANALYSES_DIR / persona
    (d / "audio").mkdir(parents=True, exist_ok=True)
    (d / "immersive").mkdir(parents=True, exist_ok=True)
    (d / "photos").mkdir(parents=True, exist_ok=True)
    return d


def _db_entries(pdir: Path) -> list[dict]:
    entries = []
    for path in pdir.glob("*.json"):
        try:
            d = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        if d.get("_key"):
            entries.append({
                "key": d["_key"],
                "titre_probable": d.get("titre_probable"),
                "artiste_probable": d.get("artiste_probable"),
                "style": d.get("style"),
                "epoque": d.get("epoque"),
            })
    return entries


# ─── Profils utilisateur (par utilisateur, isolés) ──────────────────────────────
# Chaque utilisateur a son dossier users/<id>/ avec meta.json (nom, persona,
# journey), session.json (bibliothèque) et progress.json (avancement des quêtes).
# La DB persona reste partagée entre tous les utilisateurs (réutilisation audio).

def _read_json(path: Path, default):
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return default
    return default


def _write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _profile_id(request: Request) -> str:
    raw = request.headers.get("X-Profile-Id", "")
    pid = re.sub(r"[^a-z0-9-]+", "", raw.lower().strip())
    return pid or "default"


def _user_dir(request: Request) -> Path:
    d = USERS_DIR / _profile_id(request)
    d.mkdir(parents=True, exist_ok=True)
    return d


def _meta(udir: Path) -> dict:
    return _read_json(udir / "meta.json", {})


def _session(udir: Path) -> list[dict]:
    return _read_json(udir / "session.json", [])


def _progress(udir: Path) -> dict:
    return _read_json(udir / "progress.json", {})


def _persona_of(udir: Path) -> str:
    return _meta(udir).get("persona") or "fun"


# ─── Image Wikipedia ──────────────────────────────────────────────────────────

_WIKI_UA = "MuseesApp/1.0 (educational; contact@example.com)"


async def _fetch_artwork_image(titre: str | None, artiste: str | None) -> bytes | None:
    if not titre:
        return None
    import httpx
    import subprocess

    thumb_url: str | None = None
    try:
        async with httpx.AsyncClient(headers={"User-Agent": _WIKI_UA}, timeout=8, follow_redirects=True) as client:
            # Wikipedia rate-limits (429) bursts of requests; retry with backoff.
            async def wiki_get(url, params=None):
                for delay in (0, 0.5, 1.5):
                    if delay:
                        await asyncio.sleep(delay)
                    r = await client.get(url, params=params)
                    if r.status_code != 429:
                        return r
                return r

            # Try REST summary first
            slug = titre.replace(" ", "_")
            r = await wiki_get(f"https://en.wikipedia.org/api/rest_v1/page/summary/{slug}")
            if r.status_code == 200:
                thumb_url = (r.json().get("thumbnail") or {}).get("source")

            # Fallback: search API + pageimages
            if not thumb_url:
                query = f"{titre} {artiste or ''}".strip()
                r = await wiki_get("https://en.wikipedia.org/w/api.php", params={
                    "action": "query", "list": "search",
                    "srsearch": query, "format": "json", "srlimit": 1,
                })
                results = r.json().get("query", {}).get("search", [])
                if results:
                    r = await wiki_get("https://en.wikipedia.org/w/api.php", params={
                        "action": "query", "titles": results[0]["title"],
                        "prop": "pageimages", "format": "json", "pithumbsize": 800,
                    })
                    pages = r.json().get("query", {}).get("pages", {})
                    thumb_url = next(iter(pages.values())).get("thumbnail", {}).get("source")
    except Exception:
        pass

    if not thumb_url:
        return None

    # upload.wikimedia.org blocks Python TLS — use curl
    try:
        result = await asyncio.to_thread(
            subprocess.run,
            ["curl", "-sL", "--max-time", "10", thumb_url],
            capture_output=True,
        )
        img = result.stdout
        if img and len(img) > 5000:
            return img
    except Exception:
        pass
    return None


# ─── Routes ───────────────────────────────────────────────────────────────────

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/profiles")
async def profiles_route():
    """All existing profiles, for the login screen."""
    out = []
    for d in sorted(USERS_DIR.iterdir()) if USERS_DIR.exists() else []:
        if not d.is_dir():
            continue
        m = _meta(d)
        if not m.get("id"):
            continue
        out.append({
            "id": m["id"],
            "name": m.get("name"),
            "persona": m.get("persona"),
            "journey": m.get("journey"),
            "library_count": len(_session(d)),
            "created_at": m.get("created_at") or "",
        })
    out.sort(key=lambda p: p["created_at"], reverse=True)  # newest first
    return JSONResponse(out)


@app.post("/profile")
async def profile_route(request: Request):
    """Create or update the active profile (id comes from the X-Profile-Id header)."""
    data = await request.json()
    udir = _user_dir(request)
    persona = persona_from_tone(data.get("tone"))
    meta = _meta(udir)
    meta.update({
        "id": _profile_id(request),
        "name": (data.get("name") or meta.get("name") or "").strip(),
        "persona": persona,
        "created_at": meta.get("created_at") or datetime.now(timezone.utc).isoformat(),
    })
    _write_json(udir / "meta.json", meta)
    return JSONResponse({"ok": True, "id": meta["id"], "persona": persona})


@app.post("/journey")
async def journey_route(request: Request):
    """Persist the visitor's chosen journey (city / museum / artists / era)."""
    data = await request.json()
    udir = _user_dir(request)
    meta = _meta(udir)
    meta["journey"] = data
    _write_json(udir / "meta.json", meta)
    return JSONResponse({"ok": True})


@app.get("/me")
async def me_route(request: Request):
    """Everything the app needs to boot for the active profile."""
    udir = _user_dir(request)
    m = _meta(udir)
    return JSONResponse({
        "id": m.get("id"),
        "name": m.get("name"),
        "persona": m.get("persona"),
        "journey": m.get("journey"),
        "progress": _progress(udir),
        "library_count": len(_session(udir)),
    })


@app.post("/analyze")
async def analyze(request: Request, file: UploadFile = File(...)):
    image_bytes = await file.read()
    media_type = file.content_type or "image/jpeg"
    try:
        udir = _user_dir(request)
        meta = _meta(udir)
        persona = _persona_of(udir)
        pdir = _persona_dir(persona)
        profile_text = build_profile_text(meta.get("name"), persona)

        result = await asyncio.to_thread(
            analyze_artwork, image_bytes, media_type, profile_text
        )
        result["artist_id"] = match_artist(result.get("artiste_probable"))

        match_key = await asyncio.to_thread(
            find_existing_artwork, result, _db_entries(pdir)
        )

        if match_key:
            result = json.loads((pdir / f"{match_key}.json").read_text(encoding="utf-8"))
            key = match_key
        else:
            key = _phash(image_bytes)
            result["_key"] = key
            (pdir / f"{key}.json").write_text(
                json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
            )

        # Always try Wikipedia — overwrites old user photos on repeated scans
        artwork_img = await _fetch_artwork_image(
            result.get("titre_probable"), result.get("artiste_probable")
        )
        photo_path = pdir / "photos" / f"{key}.jpg"
        if artwork_img:
            photo_path.write_bytes(artwork_img)
        elif not photo_path.exists():
            photo_path.write_bytes(image_bytes)

        session = _session(udir)
        in_session = key in {e["key"] for e in session}
        artist_scans = None
        if not in_session:
            session.append({
                "key": key,
                "titre": result.get("titre_probable"),
                "artiste": result.get("artiste_probable"),
                "artist_id": result.get("artist_id"),
            })
            _write_json(udir / "session.json", session)
            # Library and quest progress advance together, from the same gate.
            artist_id = result.get("artist_id")
            if artist_id:
                progress = _progress(udir)
                progress[artist_id] = progress.get(artist_id, 0) + 1
                _write_json(udir / "progress.json", progress)
                artist_scans = progress[artist_id]

        payload = dict(result)
        payload["from_cache"] = match_key is not None
        payload["in_session"] = in_session
        payload["artist_scans"] = artist_scans  # new count, or null if nothing counted
        return JSONResponse(payload)
    except Exception as e:
        traceback.print_exc()
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/narrate")
async def narrate_route(request: Request):
    data = await request.json()
    try:
        udir = _user_dir(request)
        persona = _persona_of(udir)
        pdir = _persona_dir(persona)
        key = data.get("_key")
        if key:
            audio_file = pdir / "audio" / f"{key}.mp3"
            if audio_file.exists():
                return Response(content=audio_file.read_bytes(), media_type="audio/mpeg")

        profile_text = build_profile_text(_meta(udir).get("name"), persona)
        audio_bytes = await asyncio.to_thread(narrate, data, profile_text)

        if key:
            (pdir / "audio" / f"{key}.mp3").write_bytes(audio_bytes)

        return Response(content=audio_bytes, media_type="audio/mpeg")
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/immersive")
async def immersive_route(request: Request):
    data = await request.json()
    try:
        pdir = _persona_dir(_persona_of(_user_dir(request)))
        key = data.get("_key")
        audio_file = pdir / "immersive" / f"{key}.mp3" if key else None
        captions_file = pdir / "immersive" / f"{key}.captions.json" if key else None

        if audio_file and captions_file and audio_file.exists() and captions_file.exists():
            audio_bytes = audio_file.read_bytes()
            captions = json.loads(captions_file.read_text(encoding="utf-8"))
        else:
            audio_bytes, captions = await asyncio.to_thread(generate_immersive, data)
            if audio_file and captions_file:
                audio_file.write_bytes(audio_bytes)
                captions_file.write_text(
                    json.dumps(captions, ensure_ascii=False), encoding="utf-8"
                )

        return JSONResponse({
            "audio_base64": base64.b64encode(audio_bytes).decode("ascii"),
            "captions": captions,
        })
    except Exception as e:
        traceback.print_exc()
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/library")
async def library_route(request: Request):
    udir = _user_dir(request)
    pdir = _persona_dir(_persona_of(udir))
    items = []
    for e in reversed(_session(udir)):
        key = e["key"]
        has_narration = (pdir / "audio" / f"{key}.mp3").exists()
        has_immersive = (pdir / "immersive" / f"{key}.mp3").exists()
        items.append({
            "phash": key,
            "titre": e.get("titre"),
            "artiste": e.get("artiste"),
            "artist_id": e.get("artist_id"),
            "has_photo": (pdir / "photos" / f"{key}.jpg").exists(),
            "has_audio": has_narration or has_immersive,
            "audio_mode": "narrate" if has_narration else "immersive" if has_immersive else None,
        })
    return JSONResponse(items)


@app.get("/artwork/{key}")
async def get_artwork(key: str, request: Request):
    f = _persona_dir(_persona_of(_user_dir(request))) / f"{_safe_seg(key)}.json"
    if not f.exists():
        return JSONResponse({"error": "not found"}, status_code=404)
    return JSONResponse(json.loads(f.read_text(encoding="utf-8")))


# Asset endpoints are loaded via <img>/Audio src, which can't send headers —
# the frontend passes the persona as a query param (with a search fallback).

def _safe_seg(s: str | None) -> str:
    """Strip a path segment to safe chars — persona/key come from the client."""
    return re.sub(r"[^a-z0-9_-]+", "", (s or "").lower())


def _persona_asset(persona: str | None, subdir: str, key: str, ext: str) -> Path | None:
    key = _safe_seg(key)
    persona = _safe_seg(persona)
    candidates = []
    if persona:
        candidates.append(ANALYSES_DIR / persona / subdir / f"{key}.{ext}")
    for d in sorted(ANALYSES_DIR.iterdir()) if ANALYSES_DIR.exists() else []:
        if d.is_dir():
            candidates.append(d / subdir / f"{key}.{ext}")
    for f in candidates:
        if f.exists():
            return f
    return None


@app.get("/photos/{key}")
async def get_photo(key: str, persona: str | None = None):
    f = _persona_asset(persona, "photos", key, "jpg")
    if not f:
        return JSONResponse({"error": "not found"}, status_code=404)
    return Response(content=f.read_bytes(), media_type="image/jpeg")


@app.get("/audio/{key}")
async def get_audio(key: str, persona: str | None = None):
    f = _persona_asset(persona, "audio", key, "mp3")
    if not f:
        return JSONResponse({"error": "not found"}, status_code=404)
    return Response(content=f.read_bytes(), media_type="audio/mpeg")


@app.get("/immersive-audio/{key}")
async def get_immersive_audio(key: str, persona: str | None = None):
    f = _persona_asset(persona, "immersive", key, "mp3")
    if not f:
        return JSONResponse({"error": "not found"}, status_code=404)
    return Response(content=f.read_bytes(), media_type="audio/mpeg")


def _phash(image_bytes: bytes) -> str:
    try:
        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_GRAYSCALE)
    except Exception:
        img = None
    if img is None:
        return "0" * 16
    img = cv2.resize(img, (32, 32), interpolation=cv2.INTER_AREA).astype(np.float32)
    dct = cv2.dct(img)
    block = dct[:8, :8].flatten()
    mean = block.mean()
    bits = (block > mean)
    val = int("".join("1" if b else "0" for b in bits), 2)
    return f"{val:016x}"


dist = ROOT / "frontend" / "dist"
if dist.exists():
    app.mount("/", StaticFiles(directory=str(dist), html=True), name="static")


def _local_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "localhost"


if __name__ == "__main__":
    if not dist.exists():
        print("\n  ⚠  Build React manquant. Lance d'abord :")
        print("       cd frontend && npm run build\n")
    print(f"  URL téléphone (même WiFi) :\n\n      http://{_local_ip()}:8000\n")
    uvicorn.run(app, host="0.0.0.0", port=8000)
