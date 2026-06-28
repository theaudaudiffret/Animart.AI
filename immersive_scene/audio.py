"""Audio assembly helpers built on pydub — concatenation, looping, mixing."""

from __future__ import annotations

from io import BytesIO

from pydub import AudioSegment
from pydub import effects


def bytes_to_segment(data: bytes) -> AudioSegment:
    return AudioSegment.from_file(BytesIO(data))


def segment_to_bytes(segment: AudioSegment, format: str = "wav") -> bytes:
    buf = BytesIO()
    segment.export(buf, format=format)
    return buf.getvalue()


def normalize(segment: AudioSegment) -> AudioSegment:
    return effects.normalize(segment)


def loop_to_length(segment: AudioSegment, target_ms: int) -> AudioSegment:
    out = segment
    while len(out) < target_ms:
        out += segment
    return out[:target_ms]


def mix(
    background: AudioSegment,
    foreground: AudioSegment,
    *,
    bg_gain_db: float = -8,
    fg_gain_db: float = 0,
    position_ms: int = 0,
) -> AudioSegment:
    bg = background + bg_gain_db
    fg = foreground + fg_gain_db
    return bg.overlay(fg, position=position_ms)
