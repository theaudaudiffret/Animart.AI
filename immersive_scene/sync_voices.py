"""Import English voices from ElevenLabs My Voices into the local catalog."""

from __future__ import annotations

import json
import os
from pathlib import Path

from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs

CATALOG_PATH = Path(__file__).with_name("voice_catalog.json")


def sync_voice_catalog() -> list[dict]:
    load_dotenv()
    client = ElevenLabs(api_key=os.environ["ELEVENLABS_API_KEY"])
    response = client.voices.get_all()

    catalog = []
    for voice in response.voices:
        labels = dict(voice.labels or {})
        if labels.get("language") != "en":
            continue
        catalog.append({
            "voice_id": voice.voice_id,
            "name": voice.name,
            "description": voice.description or voice.name,
            "category": voice.category,
            "gender": labels.get("gender"),
            "age": labels.get("age"),
            "accent": labels.get("accent"),
            "locale": labels.get("locale"),
            "descriptive": labels.get("descriptive"),
            "use_case": labels.get("use_case"),
        })

    catalog.sort(key=lambda item: item["name"].lower())
    CATALOG_PATH.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return catalog


if __name__ == "__main__":
    voices = sync_voice_catalog()
    print(f"Imported {len(voices)} English voices into {CATALOG_PATH}")
