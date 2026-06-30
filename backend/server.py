import asyncio
import os
import re
import socket
import traceback
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from pathlib import Path

import cv2
import numpy as np
import uvicorn
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from backend import storage, supa
from backend.analyzer import analyze_artwork
from backend.dedup import find_existing_artwork
from backend.immersive import generate_immersive
from backend.matcher import match_artist
from backend.narrator import narrate
from backend.profile import build_profile_text, persona_from_tone

load_dotenv()

ROOT = Path(__file__).parent.parent


# ─── Config (env) ───────────────────────────────────────────────────────────────

def _int_env(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        return default


MAX_SCANS_PER_DAY = _int_env("MAX_SCANS_PER_DAY", 200)        # 0 = illimité
MAX_CONCURRENT_IMMERSIVE = _int_env("MAX_CONCURRENT_IMMERSIVE", 4)
THREAD_LIMIT = _int_env("THREAD_LIMIT", 200)                  # appels IO en vol par worker
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "*")

# Génération immersive lourde (ffmpeg + pydub) : on borne la concurrence par worker.
_immersive_sem = asyncio.Semaphore(MAX_CONCURRENT_IMMERSIVE)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Les appels Claude/ElevenLabs (sync) tournent en to_thread → on agrandit le pool
    # par défaut pour tenir des dizaines d'appels IO simultanés sans sérialiser.
    asyncio.get_running_loop().set_default_executor(
        ThreadPoolExecutor(max_workers=THREAD_LIMIT, thread_name_prefix="iopool")
    )
    yield


app = FastAPI(lifespan=lifespan)

_origins = ["*"] if ALLOWED_ORIGINS.strip() == "*" else [
    o.strip() for o in ALLOWED_ORIGINS.split(",") if o.strip()
]
app.add_middleware(CORSMiddleware, allow_origins=_origins, allow_methods=["*"], allow_headers=["*"])


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

@app.get("/health")
async def health():
    return {"ok": True}


@app.post("/profile")
async def profile_route(request: Request, user_id: str = Depends(supa.current_user)):
    """Create or update the active profile (identity comes from the verified JWT)."""
    data = await request.json()
    persona = persona_from_tone(data.get("tone"))
    existing = await supa.get_profile(user_id)
    name = (data.get("name") or (existing or {}).get("name") or "").strip()
    await supa.upsert_profile(user_id, name, persona)
    return JSONResponse({"ok": True, "id": user_id, "persona": persona})


@app.post("/journey")
async def journey_route(request: Request, user_id: str = Depends(supa.current_user)):
    """Persist the visitor's chosen journey (city / museum / artists / era)."""
    data = await request.json()
    await supa.set_journey(user_id, data)
    return JSONResponse({"ok": True})


@app.get("/me")
async def me_route(user_id: str = Depends(supa.current_user)):
    """Everything the app needs to boot for the active profile (persona null ⇒ onboarding)."""
    profile = await supa.get_profile(user_id)
    progress = await supa.get_progress(user_id)
    count = await supa.library_count(user_id)
    return JSONResponse({
        "id": user_id,
        "name": (profile or {}).get("name"),
        "persona": (profile or {}).get("persona"),
        "journey": (profile or {}).get("journey"),
        "progress": progress,
        "library_count": count,
    })


@app.post("/analyze")
async def analyze(request: Request, file: UploadFile = File(...), user_id: str = Depends(supa.current_user)):
    image_bytes = await file.read()
    media_type = file.content_type or "image/jpeg"
    try:
        if not await supa.check_and_bump_usage(user_id, MAX_SCANS_PER_DAY):
            return JSONResponse({"error": "Daily scan limit reached"}, status_code=429)

        profile = await supa.get_profile(user_id)
        persona = (profile or {}).get("persona") or "fun"
        profile_text = build_profile_text((profile or {}).get("name"), persona)

        result = await asyncio.to_thread(analyze_artwork, image_bytes, media_type, profile_text)
        result["artist_id"] = match_artist(result.get("artiste_probable"))

        entries = await supa.db_entries(persona)
        match_key = await asyncio.to_thread(find_existing_artwork, result, entries)

        if match_key:
            art = await supa.find_artwork(persona, match_key)
            result = art["data"] if art else result
            key = match_key
            had_photo = bool(art and art.get("has_photo"))
        else:
            key = _phash(image_bytes)
            result["_key"] = key
            await supa.save_artwork(persona, key, result)
            had_photo = False

        # Always try Wikipedia — overwrites old photos on repeated scans.
        artwork_img = await _fetch_artwork_image(
            result.get("titre_probable"), result.get("artiste_probable")
        )
        if artwork_img:
            await storage.upload(persona, "photos", key, artwork_img)
            await supa.update_artwork(persona, key, {"has_photo": True})
        elif not had_photo:
            await storage.upload(persona, "photos", key, image_bytes)
            await supa.update_artwork(persona, key, {"has_photo": True})

        # Library and quest progress advance together, from the same gate.
        in_session = await supa.in_library(user_id, key)
        artist_scans = None
        if not in_session:
            await supa.add_to_library(
                user_id, persona, key,
                result.get("titre_probable"), result.get("artiste_probable"), result.get("artist_id"),
            )
            artist_id = result.get("artist_id")
            if artist_id:
                artist_scans = await supa.bump_progress(user_id, artist_id)

        payload = dict(result)
        payload["from_cache"] = match_key is not None
        payload["in_session"] = in_session
        payload["artist_scans"] = artist_scans  # new count, or null if nothing counted
        return JSONResponse(payload)
    except Exception as e:
        traceback.print_exc()
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/narrate")
async def narrate_route(request: Request, user_id: str = Depends(supa.current_user)):
    data = await request.json()
    key = data.get("_key")
    if not key:
        return JSONResponse({"error": "missing _key"}, status_code=400)
    try:
        profile = await supa.get_profile(user_id)
        persona = (profile or {}).get("persona") or "fun"

        art = await supa.find_artwork(persona, key)
        if not (art and art.get("has_audio")):
            profile_text = build_profile_text((profile or {}).get("name"), persona)
            audio_bytes = await asyncio.to_thread(narrate, data, profile_text)
            await storage.upload(persona, "audio", key, audio_bytes)
            await supa.update_artwork(persona, key, {"has_audio": True})

        return JSONResponse({"audio_url": storage.public_url(persona, "audio", key)})
    except Exception as e:
        traceback.print_exc()
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/immersive")
async def immersive_route(request: Request, user_id: str = Depends(supa.current_user)):
    data = await request.json()
    key = data.get("_key")
    if not key:
        return JSONResponse({"error": "missing _key"}, status_code=400)
    try:
        persona = await supa.persona_of(user_id)

        art = await supa.find_artwork(persona, key)
        if art and art.get("has_immersive"):
            captions = art.get("captions") or []
        else:
            async with _immersive_sem:
                audio_bytes, captions = await asyncio.to_thread(generate_immersive, data)
            await storage.upload(persona, "immersive", key, audio_bytes)
            await supa.update_artwork(persona, key, {"has_immersive": True, "captions": captions})

        return JSONResponse({
            "audio_url": storage.public_url(persona, "immersive", key),
            "captions": captions,
        })
    except Exception as e:
        traceback.print_exc()
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/library")
async def library_route(user_id: str = Depends(supa.current_user)):
    profile = await supa.get_profile(user_id)
    persona = (profile or {}).get("persona") or "fun"
    rows = await supa.get_library(user_id)  # newest-first
    flags = await supa.artworks_flags(persona, [e["key"] for e in rows])
    items = []
    for e in rows:
        f = flags.get(e["key"], {})
        has_narration = bool(f.get("has_audio"))
        has_immersive = bool(f.get("has_immersive"))
        items.append({
            "phash": e["key"],
            "titre": e.get("titre"),
            "artiste": e.get("artiste"),
            "artist_id": e.get("artist_id"),
            "has_photo": bool(f.get("has_photo")),
            "has_audio": has_narration or has_immersive,
            "audio_mode": "narrate" if has_narration else "immersive" if has_immersive else None,
        })
    return JSONResponse(items)


@app.get("/artwork/{key}")
async def get_artwork(key: str, user_id: str = Depends(supa.current_user)):
    persona = await supa.persona_of(user_id)
    art = await supa.find_artwork(persona, _safe_seg(key))
    if not art:
        return JSONResponse({"error": "not found"}, status_code=404)
    return JSONResponse(art["data"])


# Asset endpoints are loaded via <img>/Audio src (can't send headers) and just
# redirect to the public CDN URL — no bytes flow through the backend. The frontend
# passes its active persona as a query param.

def _safe_seg(s: str | None) -> str:
    """Strip a path segment to safe chars — persona/key come from the client."""
    return re.sub(r"[^a-z0-9_-]+", "", (s or "").lower())


def _asset_redirect(persona: str | None, kind: str, key: str) -> RedirectResponse:
    return RedirectResponse(
        storage.public_url(_safe_seg(persona) or "fun", kind, _safe_seg(key)),
        status_code=307,
    )


@app.get("/photos/{key}")
async def get_photo(key: str, persona: str | None = None):
    return _asset_redirect(persona, "photos", key)


@app.get("/audio/{key}")
async def get_audio(key: str, persona: str | None = None):
    return _asset_redirect(persona, "audio", key)


@app.get("/immersive-audio/{key}")
async def get_immersive_audio(key: str, persona: str | None = None):
    return _asset_redirect(persona, "immersive", key)


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


# Le SPA buildé est servi par le même serveur (monolithe). Monté en dernier pour ne
# pas masquer les routes API ci-dessus.
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
