import json
import os
from pathlib import Path

import anthropic
from elevenlabs.client import ElevenLabs

ROOT = Path(__file__).parent.parent
NARRATION_PROMPT = ROOT / "docs" / "narration_prompt.md"

DEFAULT_VOICE_ID = "XB0fDUnXU5powFXDhCwa"  # Charlotte — multilingue


def _generate_narration_text(data: dict, profile_text: str | None) -> str:
    system = NARRATION_PROMPT.read_text(encoding="utf-8")
    long_mem = profile_text or ""

    user_content = f"""## Artwork analysis

```json
{json.dumps(data, ensure_ascii=False, indent=2)}
```

## Long-term memory (visitor profile)

{long_mem}"""

    client = anthropic.Anthropic()
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        system=system,
        messages=[{"role": "user", "content": user_content}],
    )
    return response.content[0].text.strip()


def narrate(data: dict, profile_text: str | None = None) -> bytes:
    narration_text = _generate_narration_text(data, profile_text)

    client = ElevenLabs(api_key=os.environ["ELEVENLABS_API_KEY"])
    voice_id = os.getenv("ELEVENLABS_VOICE_ID", DEFAULT_VOICE_ID)

    audio_iter = client.text_to_speech.convert(
        voice_id=voice_id,
        text=narration_text,
        model_id="eleven_multilingual_v2",
        output_format="mp3_44100_128",
    )
    audio = b"".join(audio_iter)

    return audio
