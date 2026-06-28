import json

import anthropic

_SCHEMA = {
    "type": "object",
    "properties": {"match_key": {"type": ["string", "null"]}},
    "required": ["match_key"],
    "additionalProperties": False,
}

_SYSTEM = (
    "Tu es un agent de déduplication d'œuvres d'art. On te donne une nouvelle œuvre "
    "analysée et une liste d'œuvres déjà enregistrées (chacune avec une clé 'key'). "
    "Détermine si la nouvelle œuvre désigne la MÊME œuvre physique qu'une œuvre existante "
    "— même si le titre, la description ou l'artiste sont formulés différemment "
    "(ex. « La Joconde » = « Mona Lisa »). Réponds avec la clé de l'œuvre correspondante, "
    "ou null si la nouvelle œuvre n'existe pas encore dans la liste. Ne considère comme "
    "identiques que des œuvres réellement identiques, pas seulement du même artiste ou style."
)


def find_existing_artwork(new_artwork: dict, entries: list[dict]) -> str | None:
    """Retourne la clé d'une œuvre déjà enregistrée correspondant à new_artwork, ou None."""
    if not entries:
        return None

    new_summary = {
        k: new_artwork.get(k)
        for k in ("titre_probable", "artiste_probable", "style", "epoque", "technique")
    }
    user_content = (
        "## Nouvelle œuvre\n"
        f"```json\n{json.dumps(new_summary, ensure_ascii=False, indent=2)}\n```\n\n"
        "## Œuvres déjà enregistrées\n"
        f"```json\n{json.dumps(entries, ensure_ascii=False, indent=2)}\n```"
    )

    client = anthropic.Anthropic()
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=128,
        system=_SYSTEM,
        messages=[{"role": "user", "content": user_content}],
        output_config={"format": {"type": "json_schema", "schema": _SCHEMA}},
    )
    text = next(b.text for b in response.content if b.type == "text")
    match_key = json.loads(text).get("match_key")
    valid_keys = {e["key"] for e in entries}
    return match_key if match_key in valid_keys else None
