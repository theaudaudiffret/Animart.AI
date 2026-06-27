import os
from elevenlabs.client import ElevenLabs

# Charlotte — voix multilingue ElevenLabs, fonctionne bien en français
DEFAULT_VOICE_ID = "XB0fDUnXU5powFXDhCwa"


def summary_to_text(data: dict) -> str:
    parts = []
    titre = data.get("titre_probable")
    artiste = data.get("artiste_probable")
    style = data.get("style")
    epoque = data.get("epoque")
    technique = data.get("technique")
    description = data.get("description")
    ambiance = data.get("ambiance")
    sujets: list = data.get("sujets") or []

    if titre and artiste:
        parts.append(f"Cette œuvre, intitulée {titre}, est attribuée à {artiste}.")
    elif titre:
        parts.append(f"Cette œuvre est probablement intitulée {titre}.")
    elif artiste:
        parts.append(f"Cette œuvre est attribuée à {artiste}.")

    if style and epoque:
        parts.append(f"Il s'agit d'une œuvre de style {style}, datant du {epoque}.")
    elif style:
        parts.append(f"Il s'agit d'une œuvre de style {style}.")

    if technique:
        parts.append(f"Elle est réalisée en {technique}.")

    if description:
        parts.append(description)

    if ambiance:
        parts.append(f"L'ambiance qui se dégage de cette œuvre est {ambiance}.")

    if sujets:
        parts.append(f"Les thèmes abordés sont : {', '.join(sujets)}.")

    return " ".join(parts)


def narrate(data: dict) -> bytes:
    text = summary_to_text(data)
    client = ElevenLabs(api_key=os.environ["ELEVENLABS_API_KEY"])
    voice_id = os.getenv("ELEVENLABS_VOICE_ID", DEFAULT_VOICE_ID)

    audio_iter = client.text_to_speech.convert(
        voice_id=voice_id,
        text=text,
        model_id="eleven_multilingual_v2",
        output_format="mp3_44100_128",
    )
    return b"".join(audio_iter)
