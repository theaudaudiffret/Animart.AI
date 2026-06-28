import json
import os
from datetime import datetime
from pathlib import Path

import anthropic
from elevenlabs.client import ElevenLabs

ROOT = Path(__file__).parent.parent
NARRATION_PROMPT = ROOT / "docs" / "narration_prompt.md"
SHORT_TERM_MEMORY = ROOT / "docs" / "short_term_memory.md"
LONG_TERM_MEMORY = ROOT / "docs" / "long_term_memory.md"

MAX_MEMORY_ENTRIES = 10
DEFAULT_VOICE_ID = "XB0fDUnXU5powFXDhCwa"  # Charlotte — multilingue


def _generate_narration_text(data: dict) -> str:
    system = NARRATION_PROMPT.read_text(encoding="utf-8")
    short_mem = SHORT_TERM_MEMORY.read_text(encoding="utf-8")
    long_mem = LONG_TERM_MEMORY.read_text(encoding="utf-8") if LONG_TERM_MEMORY.exists() else ""

    user_content = f"""## Artwork analysis

```json
{json.dumps(data, ensure_ascii=False, indent=2)}
```

## Short-term memory (recently visited artworks)

{short_mem}

## Long-term memory (visitor profile)

{long_mem}"""

    client = anthropic.Anthropic()
    response = client.messages.create(
        model="claude-opus-4-8",
        max_tokens=512,
        system=system,
        messages=[{"role": "user", "content": user_content}],
    )
    return response.content[0].text.strip()


def update_short_term_memory(narration_text: str) -> None:
    new_entry = f"## {datetime.now().strftime('%Y-%m-%d %H:%M')}\n\n{narration_text}\n"

    content = SHORT_TERM_MEMORY.read_text(encoding="utf-8")
    header = "# Short-term memory — recently visited artworks\n\n"

    # Découper en entrées (FIFO) : chaque section commence par "## "
    parts = content.split("\n## ")
    entries = [f"## {p}".rstrip() for p in parts if p.strip() and not p.startswith("#")]
    entries.append(new_entry)
    entries = entries[-MAX_MEMORY_ENTRIES:]  # first-in first-out

    SHORT_TERM_MEMORY.write_text(header + "\n\n".join(entries) + "\n", encoding="utf-8")


def narrate(data: dict) -> bytes:
    narration_text = _generate_narration_text(data)

    client = ElevenLabs(api_key=os.environ["ELEVENLABS_API_KEY"])
    voice_id = os.getenv("ELEVENLABS_VOICE_ID", DEFAULT_VOICE_ID)

    audio_iter = client.text_to_speech.convert(
        voice_id=voice_id,
        text=narration_text,
        model_id="eleven_multilingual_v2",
        output_format="mp3_44100_128",
    )
    audio = b"".join(audio_iter)

    update_short_term_memory(narration_text)

    return audio
