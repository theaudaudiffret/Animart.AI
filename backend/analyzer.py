import base64
import json
from pathlib import Path

import anthropic

ROOT = Path(__file__).parent.parent

ARTWORK_SCHEMA = {
    "type": "object",
    "properties": {
        "titre_probable": {"type": ["string", "null"]},
        "artiste_probable": {"type": ["string", "null"]},
        "style": {"type": "string"},
        "epoque": {"type": ["string", "null"]},
        "technique": {"type": ["string", "null"]},
        "description": {"type": "string"},
        "depicted_moment": {"type": ["string", "null"]},
        "narrative_context": {"type": ["string", "null"]},
        "scene_characters": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name_or_role": {"type": "string"},
                    "presence": {
                        "type": "string",
                        "enum": ["visible", "implied", "off_scene"],
                    },
                    "connection_to_moment": {"type": "string"},
                },
                "required": ["name_or_role", "presence", "connection_to_moment"],
                "additionalProperties": False,
            },
        },
        "couleurs_dominantes": {"type": "array", "items": {"type": "string"}},
        "ambiance": {"type": "string"},
        "sujets": {"type": "array", "items": {"type": "string"}},
    },
    "required": [
        "titre_probable", "artiste_probable", "style", "epoque", "technique",
        "description", "depicted_moment", "narrative_context", "scene_characters",
        "couleurs_dominantes", "ambiance", "sujets",
    ],
    "additionalProperties": False,
}


def analyze_artwork(image_bytes: bytes, media_type: str, visitor_profile: str | None = None) -> dict:
    system_prompt = (ROOT / "docs" / "prompt.md").read_text(encoding="utf-8")
    image_data = base64.standard_b64encode(image_bytes).decode("utf-8")

    instruction = "Analyze this artwork and provide a complete summary in English."
    if visitor_profile:
        instruction = (
            f"{visitor_profile}\n\n{instruction} Adapt the vocabulary and the angles "
            "covered (description and ambiance fields) to the visitor profile above."
        )

    client = anthropic.Anthropic()
    response = client.messages.create(
        model="claude-opus-4-8",
        max_tokens=3072,
        system=system_prompt,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {"type": "base64", "media_type": media_type, "data": image_data},
                },
                {"type": "text", "text": instruction},
            ],
        }],
        output_config={"format": {"type": "json_schema", "schema": ARTWORK_SCHEMA}},
    )

    text = next(b.text for b in response.content if b.type == "text")
    return json.loads(text)
