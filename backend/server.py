import asyncio
import base64
import json
import socket
import urllib.parse
import urllib.request
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
from backend.profile import load_persona, load_profile_text, save_profile

load_dotenv()

ROOT = Path(__file__).parent.parent
ANALYSES_DIR = ROOT / "analyses"
ANALYSES_DIR.mkdir(exist_ok=True)

SHORT_TERM_MEMORY = ROOT / "docs" / "short_term_memory.md"
LONG_TERM_MEMORY = ROOT / "docs" / "long_term_memory.md"
SESSION_FILE = ROOT / "docs" / "session.json"

SHORT_TERM_INITIAL = "# Short-term memory — recent visits\n\n_(empty — analyzed works will appear here during the visit)_\n"
LONG_TERM_INITIAL = "# Long-term memory\n\n_(will be filled after the welcome questionnaire)_\n"


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


# ─── Session utilisateur ───────────────────────────────────────────────────────

def _session() -> list[dict]:
    if SESSION_FILE.exists():
        try:
            return json.loads(SESSION_FILE.read_text(encoding="utf-8"))
        except Exception:
            return []
    return []


def _session_add(entry: dict) -> None:
    s = _session()
    s.append(entry)
    SESSION_FILE.write_text(json.dumps(s, ensure_ascii=False, indent=2), encoding="utf-8")


def _reset_session_and_memories() -> None:
    SESSION_FILE.write_text("[]", encoding="utf-8")
    SHORT_TERM_MEMORY.write_text(SHORT_TERM_INITIAL, encoding="utf-8")
    LONG_TERM_MEMORY.write_text(LONG_TERM_INITIAL, encoding="utf-8")


# ─── Image Wikipedia ──────────────────────────────────────────────────────────

_HEADERS = {"User-Agent": "MuseesApp/1.0 (educational; contact@example.com)"}


def _wiki_get(url: str, timeout: int = 6) -> bytes:
    req = urllib.request.Request(url, headers=_HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def _fetch_artwork_image_sync(titre: str, artiste: str | None) -> bytes | None:
    query = f"{titre} {artiste or ''}".strip()
    try:
        params = urllib.parse.urlencode({
            "action": "query", "list": "search",
            "srsearch": query, "format": "json", "srlimit": 1,
        })
        results = json.loads(_wiki_get(
            f"https://en.wikipedia.org/w/api.php?{params}"
        )).get("query", {}).get("search", [])
        if not results:
            return None
        page_title = results[0]["title"]

        params = urllib.parse.urlencode({
            "action": "query", "titles": page_title,
            "prop": "pageimages", "format": "json", "pithumbsize": 1200,
        })
        pages = json.loads(_wiki_get(
            f"https://en.wikipedia.org/w/api.php?{params}"
        )).get("query", {}).get("pages", {})
        thumb_url = next(iter(pages.values())).get("thumbnail", {}).get("source")
        if not thumb_url:
            return None

        return _wiki_get(thumb_url, timeout=10)
    except Exception:
        return None


async def _fetch_artwork_image(titre: str | None, artiste: str | None) -> bytes | None:
    if not titre:
        return None
    return await asyncio.to_thread(_fetch_artwork_image_sync, titre, artiste)


# ─── Routes ───────────────────────────────────────────────────────────────────

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.post("/profile")
async def profile_route(request: Request):
    data = await request.json()
    persona = save_profile(data)
    return JSONResponse({"ok": True, "persona": persona})


@app.post("/new-profile")
async def new_profile_route():
    _reset_session_and_memories()
    return JSONResponse({"ok": True})


@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    image_bytes = await file.read()
    media_type = file.content_type or "image/jpeg"
    try:
        persona = load_persona()
        pdir = _persona_dir(persona)

        result = await asyncio.to_thread(
            analyze_artwork, image_bytes, media_type, load_profile_text()
        )
        result["artist_id"] = match_artist(result.get("artiste_probable"))

        match_key = await asyncio.to_thread(
            find_existing_artwork, result, _db_entries(pdir)
        )

        if match_key:
            fresh_result = result
            result_path = pdir / f"{match_key}.json"
            result = json.loads(result_path.read_text(encoding="utf-8"))
            context_fields = ("depicted_moment", "narrative_context", "scene_characters")
            if any(field not in result for field in context_fields):
                for field in context_fields:
                    result[field] = fresh_result.get(field)
                result_path.write_text(
                    json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
                )
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

        in_session = key in {e["key"] for e in _session()}
        if not in_session:
            _session_add({
                "key": key,
                "titre": result.get("titre_probable"),
                "artiste": result.get("artiste_probable"),
                "artist_id": result.get("artist_id"),
            })

        payload = dict(result)
        payload["from_cache"] = match_key is not None
        payload["in_session"] = in_session
        return JSONResponse(payload)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/narrate")
async def narrate_route(request: Request):
    data = await request.json()
    try:
        pdir = _persona_dir(load_persona())
        key = data.get("_key")
        if key:
            audio_file = pdir / "audio" / f"{key}.mp3"
            if audio_file.exists():
                return Response(content=audio_file.read_bytes(), media_type="audio/mpeg")

        audio_bytes = await asyncio.to_thread(narrate, data)

        if key:
            (pdir / "audio" / f"{key}.mp3").write_bytes(audio_bytes)

        return Response(content=audio_bytes, media_type="audio/mpeg")
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/immersive")
async def immersive_route(request: Request):
    data = await request.json()
    try:
        pdir = _persona_dir(load_persona())
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
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/library")
async def library_route():
    pdir = _persona_dir(load_persona())
    items = []
    for e in reversed(_session()):
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


@app.get("/photos/{key}")
async def get_photo(key: str):
    f = _persona_dir(load_persona()) / "photos" / f"{key}.jpg"
    if not f.exists():
        return JSONResponse({"error": "not found"}, status_code=404)
    return Response(content=f.read_bytes(), media_type="image/jpeg")


@app.get("/audio/{key}")
async def get_audio(key: str):
    f = _persona_dir(load_persona()) / "audio" / f"{key}.mp3"
    if not f.exists():
        return JSONResponse({"error": "not found"}, status_code=404)
    return Response(content=f.read_bytes(), media_type="audio/mpeg")


@app.get("/immersive-audio/{key}")
async def get_immersive_audio(key: str):
    f = _persona_dir(load_persona()) / "immersive" / f"{key}.mp3"
    if not f.exists():
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
