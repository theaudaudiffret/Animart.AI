"""Thin wrapper around the Anthropic Python SDK for the immersive scene pipeline."""

from __future__ import annotations

from dotenv import load_dotenv
from anthropic import Anthropic
from pydantic import BaseModel

load_dotenv()

MODEL = "claude-sonnet-4-6"


def get_client() -> Anthropic:
    return Anthropic()


def ask(client: Anthropic, prompt: str, *, max_tokens: int = 4096) -> str:
    response = client.messages.create(
        model=MODEL,
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    return next(block.text for block in response.content if block.type == "text")


class Character(BaseModel):
    id: str
    name: str
    role: str
    voice_id: str
    casting_reason: str


class DialogueLine(BaseModel):
    id: str
    character_id: str
    text: str
    sound_cue: str | None


class ImmersiveContent(BaseModel):
    ambient_textures: list[str]
    music_prompt: str
    characters: list[Character]
    dialogue: list[DialogueLine]


def generate_immersive_content(client: Anthropic, prompt: str, *, max_tokens: int = 4096) -> ImmersiveContent:
    response = client.messages.parse(
        model=MODEL,
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
        output_format=ImmersiveContent,
    )
    return response.parsed_output
