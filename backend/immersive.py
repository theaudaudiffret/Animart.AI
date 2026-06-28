"""Bridge between the app and immersive_scene, matching narrator.narrate()."""
from immersive_scene import generate_immersive_scene


def _build_artwork_info(data: dict) -> str:
    lines = [data.get("description") or ""]
    if data.get("style"):
        lines.append(f"Style: {data['style']}")
    if data.get("epoque"):
        lines.append(f"Period: {data['epoque']}")
    if data.get("technique"):
        lines.append(f"Technique: {data['technique']}")
    if data.get("depicted_moment"):
        lines.append(f"Depicted dramatic moment: {data['depicted_moment']}")
    if data.get("narrative_context"):
        lines.append(f"Established narrative context: {data['narrative_context']}")
    if data.get("scene_characters"):
        character_lines = [
            f"{character['name_or_role']} ({character['presence']}): "
            f"{character['connection_to_moment']}"
            for character in data["scene_characters"]
        ]
        lines.append("Characters connected to this moment:\n- " + "\n- ".join(character_lines))
    if data.get("sujets"):
        lines.append(f"Subjects: {', '.join(data['sujets'])}")
    if data.get("ambiance"):
        lines.append(f"Mood: {data['ambiance']}")
    return "\n".join(lines)


def generate_immersive(data: dict) -> tuple[bytes, list[dict]]:
    artwork_info = _build_artwork_info(data)

    audio_path, captions = generate_immersive_scene(
        data.get("titre_probable") or "Artwork",
        artwork_info,
        artist_name=data.get("artiste_probable") or "",
    )

    return audio_path.read_bytes(), captions
