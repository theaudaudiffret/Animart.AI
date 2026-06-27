import json
import socket
from datetime import datetime
from pathlib import Path

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, File, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from backend.analyzer import analyze_artwork
from backend.narrator import narrate
from backend.profile import load_profile_text, save_profile

load_dotenv()

ROOT = Path(__file__).parent.parent
ANALYSES_DIR = ROOT / "analyses"
ANALYSES_DIR.mkdir(exist_ok=True)

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.post("/profile")
async def profile_route(request: Request):
    data = await request.json()
    save_profile(data)
    return JSONResponse({"ok": True})


@app.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    image_bytes = await file.read()
    media_type = file.content_type or "image/jpeg"
    try:
        result = analyze_artwork(image_bytes, media_type, load_profile_text())
        _save(result)
        return JSONResponse(result)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.post("/narrate")
async def narrate_route(request: Request):
    data = await request.json()
    try:
        audio_bytes = narrate(data)
        return Response(content=audio_bytes, media_type="audio/mpeg")
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


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
