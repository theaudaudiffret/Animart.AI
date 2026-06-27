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
        "couleurs_dominantes": {"type": "array", "items": {"type": "string"}},
        "ambiance": {"type": "string"},
        "sujets": {"type": "array", "items": {"type": "string"}},
    },
    "required": [
        "titre_probable", "artiste_probable", "style", "epoque", "technique",
        "description", "couleurs_dominantes", "ambiance", "sujets",
    ],
    "additionalProperties": False,
}


def analyze_artwork(image_bytes: bytes, media_type: str, visitor_profile: str | None = None) -> dict:
    system_prompt = (ROOT / "docs" / "prompt.md").read_text(encoding="utf-8")
    image_data = base64.standard_b64encode(image_bytes).decode("utf-8")

    instruction = "Analyse cette œuvre d'art et fournis un résumé complet."
    if visitor_profile:
        instruction = (
            f"{visitor_profile}\n\n{instruction} Adapte le vocabulaire et les angles "
            "abordés (champs description et ambiance) au profil du visiteur ci-dessus."
        )

    client = anthropic.Anthropic()
    response = client.messages.create(
        model="claude-opus-4-8",
        max_tokens=2048,
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
