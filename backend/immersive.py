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
