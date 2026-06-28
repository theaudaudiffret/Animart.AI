"""Thin wrapper around the ElevenLabs Python SDK for the immersive scene pipeline."""

from __future__ import annotations

import os

from dotenv import load_dotenv
from elevenlabs import DialogueInput
from elevenlabs.client import ElevenLabs

load_dotenv()


def get_client() -> ElevenLabs:
    return ElevenLabs(api_key=os.environ["ELEVENLABS_API_KEY"])


def text_to_dialogue(client: ElevenLabs, lines: list[tuple[str, str]]) -> bytes:
    """Convert (text, voice_id) pairs into a single mixed dialogue audio — one API call."""
    inputs = [DialogueInput(text=text, voice_id=voice_id) for text, voice_id in lines]
    chunks = client.text_to_dialogue.convert(inputs=inputs)
    return b"".join(chunks)


SOUND_EFFECTS_MAX_CHARS = 450  # hard limit enforced by the ElevenLabs API
LOOPABLE_SOUND_EFFECTS_MODEL = "eleven_text_to_sound_v2"  # required for loop=True


def text_to_sound_effects(
    client: ElevenLabs,
    prompt: str,
    *,
    duration_seconds: float = 25.0,
    prompt_influence: float = 0.3,
    loop: bool = False,
) -> bytes:
    if len(prompt) > SOUND_EFFECTS_MAX_CHARS:
        prompt = prompt[:SOUND_EFFECTS_MAX_CHARS].rsplit(" ", 1)[0]
    chunks = client.text_to_sound_effects.convert(
        text=prompt,
        duration_seconds=duration_seconds,
        prompt_influence=prompt_influence,
        loop=loop,
        model_id=LOOPABLE_SOUND_EFFECTS_MODEL if loop else None,
    )
    return b"".join(chunks)


def compose_music(client: ElevenLabs, prompt: str, *, length_ms: int) -> bytes:
    chunks = client.music.compose(
        prompt=prompt,
        music_length_ms=length_ms,
        model_id="music_v2",
        force_instrumental=True,
    )
    return b"".join(chunks)
