import json
import shutil
import socket
from datetime import datetime
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
from backend.matcher import match_artist
from backend.narrator import narrate
from backend.profile import load_profile_text, save_profile

load_dotenv()

ROOT = Path(__file__).parent.parent
ANALYSES_DIR = ROOT / "analyses"
ANALYSES_DIR.mkdir(exist_ok=True)
OLD_PROFILES_DIR = ROOT / "old-profiles"
AUDIO_DIR = ANALYSES_DIR / "audio"
AUDIO_DIR.mkdir(exist_ok=True)
PHOTOS_DIR = ANALYSES_DIR / "photos"
PHOTOS_DIR.mkdir(exist_ok=True)

SHORT_TERM_MEMORY = ROOT / "docs" / "short_term_memory.md"
LONG_TERM_MEMORY = ROOT / "docs" / "long_term_memory.md"

SHORT_TERM_INITIAL = "# Mémoire court terme — visites récentes\n\n_(vide — les œuvres analysées apparaîtront ici au fil de la visite)_\n"
LONG_TERM_INITIAL = "# Mémoire long terme\n\n_(sera remplie après le questionnaire de bienvenue)_\n"


def _reset_memories() -> None:
    SHORT_TERM_MEMORY.write_text(SHORT_TERM_INITIAL, encoding="utf-8")
    LONG_TERM_MEMORY.write_text(LONG_TERM_INITIAL, encoding="utf-8")


app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.post("/profile")
async def profile_route(request: Request):
    data = await request.json()
    save_profile(data)
    return JSONResponse({"ok": True})


def _archive_analyses() -> int | None:
    """Déplace le contenu courant de analyses/ dans old-profiles/N (N auto-incrémenté)."""
    if not any(ANALYSES_DIR.glob("*.json")):
        return None  # rien d'analysé à archiver
    items = [p for p in ANALYSES_DIR.iterdir() if p.name != ".gitkeep"]
    OLD_PROFILES_DIR.mkdir(exist_ok=True)
    existing = [int(p.name) for p in OLD_PROFILES_DIR.iterdir() if p.is_dir() and p.name.isdigit()]
    n = max(existing) + 1 if existing else 1
    dest = OLD_PROFILES_DIR / str(n)
    dest.mkdir()
    for item in items:
        shutil.move(str(item), str(dest / item.name))
    return n


@app.post("/new-profile")
async def new_profile_route():
    archived = _archive_analyses()
    AUDIO_DIR.mkdir(exist_ok=True)
    PHOTOS_DIR.mkdir(exist_ok=True)
    _reset_memories()
    return JSONResponse({"ok": True, "archived": archived})


@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    image_bytes = await file.read()
    media_type = file.content_type or "image/jpeg"
    try:
        phash = _phash(image_bytes)
        cached = _find_cached(phash)
        if cached:
            payload = {k: v for k, v in cached.items() if k != "_phash"}
            payload["from_cache"] = True
            return JSONResponse(payload)

        result = analyze_artwork(image_bytes, media_type, load_profile_text())
        result["artist_id"] = match_artist(result.get("artiste_probable"))
        result["_phash"] = phash
        _save(result)
        (PHOTOS_DIR / f"{phash}.jpg").write_bytes(image_bytes)
        payload = {k: v for k, v in result.items() if k != "_phash"}
        payload["from_cache"] = False
        return JSONResponse(payload)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/narrate")
async def narrate_route(request: Request):
    data = await request.json()
    try:
        phash = _find_phash_for_data(data)
        if phash:
            audio_file = AUDIO_DIR / f"{phash}.mp3"
            if audio_file.exists():
                return Response(content=audio_file.read_bytes(), media_type="audio/mpeg")

        audio_bytes = narrate(data)

        if phash:
            (AUDIO_DIR / f"{phash}.mp3").write_bytes(audio_bytes)

        return Response(content=audio_bytes, media_type="audio/mpeg")
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


def _phash(image_bytes: bytes) -> str:
    """Perceptual hash (64-bit DCT) — same painting ≈ hamming distance ≤ 10."""
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


def _hamming(a: str, b: str) -> int:
    return bin(int(a, 16) ^ int(b, 16)).count("1")


PHASH_THRESHOLD = 8  # bits différents tolérés sur 64


def _find_cached(phash: str) -> dict | None:
    for path in sorted(ANALYSES_DIR.glob("*.json"), reverse=True):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            stored = data.get("_phash")
            if stored and _hamming(phash, stored) <= PHASH_THRESHOLD:
                return data
        except Exception:
            continue
    return None


@app.get("/library")
async def library_route():
    items = []
    for path in sorted(ANALYSES_DIR.glob("*.json"), reverse=True):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            phash = data.get("_phash")
            if not phash:
                continue
            items.append({
                "phash": phash,
                "titre": data.get("titre_probable"),
                "artiste": data.get("artiste_probable"),
                "has_photo": (PHOTOS_DIR / f"{phash}.jpg").exists(),
                "has_audio": (AUDIO_DIR / f"{phash}.mp3").exists(),
            })
        except Exception:
            continue
    return JSONResponse(items)


@app.get("/photos/{phash}")
async def get_photo(phash: str):
    f = PHOTOS_DIR / f"{phash}.jpg"
    if not f.exists():
        return JSONResponse({"error": "not found"}, status_code=404)
    return Response(content=f.read_bytes(), media_type="image/jpeg")


@app.get("/audio/{phash}")
async def get_audio(phash: str):
    f = AUDIO_DIR / f"{phash}.mp3"
    if not f.exists():
        return JSONResponse({"error": "not found"}, status_code=404)
    return Response(content=f.read_bytes(), media_type="audio/mpeg")


def _find_phash_for_data(data: dict) -> str | None:
    titre = data.get("titre_probable")
    artiste = data.get("artiste_probable")
    if not titre or not artiste:
        return None
    for path in sorted(ANALYSES_DIR.glob("*.json"), reverse=True):
        try:
            j = json.loads(path.read_text(encoding="utf-8"))
            if j.get("titre_probable") == titre and j.get("artiste_probable") == artiste:
                return j.get("_phash")
        except Exception:
            continue
    return None


def _save(result: dict) -> None:
    filename = datetime.now().strftime("%Y%m%d_%H%M%S") + ".json"
    (ANALYSES_DIR / filename).write_text(
        json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8"
    )


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
