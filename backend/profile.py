"""Visitor profile → narration persona.

Démo : le profil utilisateur se résume à 2 personas. Le ton choisi dans le
questionnaire détermine lequel ; le reste des réponses est ignoré. Le texte de
profil ci-dessous alimente la mémoire long-terme passée au narrateur.
"""

_PERSONA_TEMPLATES = {
    "serious": (
        "# Long-term memory — Visitor profile\n"
        "\n"
        "Persona: serious\n"
        "{name_line}"
        "\n"
        "The visitor prefers a serious, academic tone. Favor historical context, "
        "factual rigor and in-depth analysis of the work.\n"
    ),
    "fun": (
        "# Long-term memory — Visitor profile\n"
        "\n"
        "Persona: fun\n"
        "{name_line}"
        "\n"
        "The visitor prefers a playful, punchy tone. Open with a catchy hook that grabs "
        "attention from the very first sentence. Build the narration around surprising, "
        "juicy anecdotes and little-known stories about the work or the artist — gossip, "
        "scandals, hidden details, behind-the-scenes facts. Use vivid, modern comparisons "
        "and keep the energy high and lively throughout. Prioritize being memorable and "
        "entertaining over being exhaustive.\n"
    ),
}


def persona_from_tone(tone: str | None) -> str:
    t = (tone or "").lower()
    return "serious" if "sérieux" in t or "serieux" in t or "serious" in t else "fun"


def build_profile_text(name: str | None, persona: str) -> str:
    """The long-term-memory text handed to the narrator for this visitor."""
    name = (name or "").strip()
    name_line = f"Visitor name: {name}\n" if name else ""
    return _PERSONA_TEMPLATES.get(persona, _PERSONA_TEMPLATES["fun"]).format(name_line=name_line)
