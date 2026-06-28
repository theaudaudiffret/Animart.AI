"""Orchestrates the immersive scene generation pipeline end to end."""

from __future__ import annotations

import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from . import audio, claude_client, elevenlabs_client, prompts, voices

INTRO_MS = 2500  # pure ambience before the dialogue starts
OUTRO_MS = 4000  # ambience/music tail after the dialogue ends
DUCK_DB = -6  # extra attenuation of the ambient bed while the dialogue is speaking
FADE_MS = 150  # crossfade length at ducking transitions
MUSIC_LENGTH_MS = 30000  # generated chunk, then looped/trimmed to the scene's length


def _slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")
    return slug or "artwork"


def _strip_tags(text: str) -> str:
    """Remove inline ElevenLabs delivery tags (e.g. "[whispers]") before alignment —
    they're performance instructions, not vocalized words."""
    return re.sub(r"\[[^\]]*\]", "", text).strip()


def generate_immersive_scene(
    artwork_name: str,
    artwork_info: str,
    *,
    artist_name: str = "",
    language: str = "English",
    age: str = "adult",
    output_dir: str | Path = "outputs",
) -> tuple[Path, list[dict]]:
    """
    Generate a standalone immersive audio scene for an artwork — no spoken guide
    narration, just the scene itself: two layered ambient textures, background
    music, and a short multi-voice theatrical dialogue punctuated by synced sound
    cues, mixed into a single final .mp3 with a brief ambience-only intro and an
    outro fade.

    Returns (path to the generated file, word-level captions for the dialogue,
    already offset to match the final file's timeline).
    """
    out_dir = Path(output_dir) / _slugify(artwork_name)
    out_dir.mkdir(parents=True, exist_ok=True)

    claude = claude_client.get_client()
    content = claude_client.generate_immersive_content(
        claude,
        prompts.get_immersive_content_prompt(
            artwork_name,
            artist_name,
            artwork_info,
            voices.catalog_for_prompt(),
            language=language,
            age=age,
        ),
    )

    textures = content.ambient_textures[:2] or ["ambient texture, quiet and continuous"]
    while len(textures) < 2:
        textures.append(textures[0])

    eleven = elevenlabs_client.get_client()
    cast = {
        character.id: voices.require_voice_id(character.voice_id)
        for character in content.characters
    }
    dialogue_lines = [(line.text, cast[line.character_id]) for line in content.dialogue]
    cue_lines = [line for line in content.dialogue if line.sound_cue]

    with ThreadPoolExecutor(max_workers=4 + len(cue_lines)) as pool:
        dialogue_future = pool.submit(elevenlabs_client.text_to_dialogue, eleven, dialogue_lines)
        texture_futures = [
            pool.submit(elevenlabs_client.text_to_sound_effects, eleven, texture, loop=True)
            for texture in textures
        ]
        music_future = pool.submit(
            elevenlabs_client.compose_music, eleven, content.music_prompt, length_ms=MUSIC_LENGTH_MS
        )
        cue_futures = {
            line.id: pool.submit(
                elevenlabs_client.text_to_sound_effects, eleven, line.sound_cue, duration_seconds=2.0
            )
            for line in cue_lines
        }

        spoken_track = audio.bytes_to_segment(dialogue_future.result())
        texture_audios = [audio.bytes_to_segment(f.result()) for f in texture_futures]
        music_audio = audio.bytes_to_segment(music_future.result())
        cue_audios = {key: audio.bytes_to_segment(f.result()) for key, f in cue_futures.items()}

    # --- Captions + per-line cue positions, computed in spoken_track's own timeline ---
    stripped_lines = [_strip_tags(line.text) for line in content.dialogue]
    transcript = "\n".join(stripped_lines)
    alignment = eleven.forced_alignment.create(file=audio.segment_to_bytes(spoken_track), text=transcript)

    line_word_start = []
    word_cursor = 0
    for stripped in stripped_lines:
        line_word_start.append(word_cursor)
        word_cursor += len(stripped.split())

    total_len = INTRO_MS + len(spoken_track) + OUTRO_MS

    # --- Ambient bed: 2 textures + music, looped to the full scene length, relative levels ---
    texture_1 = audio.loop_to_length(texture_audios[0], total_len)
    texture_2 = audio.loop_to_length(texture_audios[1], total_len)
    music = audio.loop_to_length(music_audio, total_len)

    ambient = audio.mix(texture_1, texture_2, bg_gain_db=0, fg_gain_db=-3)
    ambient = audio.mix(ambient, music, bg_gain_db=0, fg_gain_db=-6)
    ambient = ambient - 8  # overall ambient level relative to the spoken voice (0dB)

    # --- Ducking: ambient dips while the dialogue speaks, breathes during intro/outro ---
    dial_start = INTRO_MS
    dial_end = INTRO_MS + len(spoken_track)
    ambient = (
        ambient[:dial_start].fade_out(FADE_MS)
        + (ambient[dial_start:dial_end] + DUCK_DB).fade_in(FADE_MS).fade_out(FADE_MS)
        + ambient[dial_end:].fade_in(FADE_MS)
    )

    # --- Punctual sound cues, placed at the start of their dialogue line ---
    for i, line in enumerate(content.dialogue):
        if not line.sound_cue:
            continue
        word_index = min(line_word_start[i], len(alignment.words) - 1)
        cue_start_ms = INTRO_MS + int(alignment.words[word_index].start * 1000)
        ambient = audio.mix(ambient, cue_audios[line.id], bg_gain_db=0, fg_gain_db=-4, position_ms=cue_start_ms)

    final = audio.mix(ambient, spoken_track, bg_gain_db=0, fg_gain_db=0, position_ms=INTRO_MS)
    final = audio.normalize(final)
    final = final.fade_out(2500)

    output_path = out_dir / "final_scene.mp3"
    final.export(output_path, format="mp3")

    captions = [
        {"text": w.text, "start": w.start + INTRO_MS / 1000, "end": w.end + INTRO_MS / 1000}
        for w in alignment.words
    ]
    return output_path, captions
