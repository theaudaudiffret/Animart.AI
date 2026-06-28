import base64
import json
from pathlib import Path

import anthropic
import cv2
import numpy as np

ROOT = Path(__file__).parent.parent

MAX_EDGE = 1280  # downscale the long edge before sending to Claude (faster upload + prefill)


def _downscale(image_bytes: bytes) -> bytes:
    """Shrink the long edge to MAX_EDGE and re-encode as JPEG. Returns the original on failure."""
    arr = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
    if arr is None:
        return image_bytes
    h, w = arr.shape[:2]
    scale = MAX_EDGE / max(h, w)
    if scale < 1:
        arr = cv2.resize(arr, (round(w * scale), round(h * scale)), interpolation=cv2.INTER_AREA)
    ok, buf = cv2.imencode(".jpg", arr, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return buf.tobytes() if ok else image_bytes

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
    image_data = base64.standard_b64encode(_downscale(image_bytes)).decode("utf-8")
    media_type = "image/jpeg"  # _downscale always re-encodes as JPEG

    instruction = "Analyze this artwork and provide a complete summary."
    if visitor_profile:
        instruction = (
            f"{visitor_profile}\n\n{instruction} Adapt the vocabulary and the angles "
            "covered (description and ambiance fields) to the visitor profile above."
        )

    client = anthropic.Anthropic()
    response = client.messages.create(
        model="claude-haiku-4-5",
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
