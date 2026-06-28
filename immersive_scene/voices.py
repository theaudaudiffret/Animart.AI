"""Local English voice catalog used to cast immersive-scene characters."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

CATALOG_PATH = Path(__file__).with_name("voice_catalog.json")


@lru_cache(maxsize=1)
def get_voice_catalog() -> list[dict]:
    if not CATALOG_PATH.exists():
        raise RuntimeError(
            "Voice catalog is missing. Run: python -m immersive_scene.sync_voices"
        )
    return json.loads(CATALOG_PATH.read_text(encoding="utf-8"))


def catalog_for_prompt() -> str:
    """Compact catalog representation for Claude's casting decision."""
    lines = []
    for voice in get_voice_catalog():
        profile = ", ".join(
            value
            for value in (
                voice.get("gender"),
                voice.get("age"),
                voice.get("accent"),
                voice.get("descriptive"),
            )
            if value
        )
        lines.append(
            f'- voice_id="{voice["voice_id"]}" | {voice["name"]} | '
            f"{profile} | {voice['description']}"
        )
    return "\n".join(lines)


def require_voice_id(voice_id: str) -> str:
    if voice_id not in {voice["voice_id"] for voice in get_voice_catalog()}:
        raise ValueError(f"Unknown voice_id selected by Claude: {voice_id}")
    return voice_id
