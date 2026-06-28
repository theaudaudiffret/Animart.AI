from pathlib import Path

ROOT = Path(__file__).parent.parent
LONG_TERM_MEMORY = ROOT / "docs" / "long_term_memory.md"

# Démo : le profil utilisateur se résume à 2 personas. Le ton choisi dans le
# questionnaire détermine lequel ; le reste des réponses est ignoré.
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
        "The visitor prefers a playful, accessible tone. Favor surprising anecdotes, "
        "fun comparisons and a lively, light narration.\n"
    ),
}


def persona_from_tone(tone: str | None) -> str:
    t = (tone or "").lower()
    return "serious" if "sérieux" in t or "serieux" in t or "serious" in t else "fun"


def save_profile(data: dict) -> str:
    persona = persona_from_tone(data.get("tone"))
    name = (data.get("name") or "").strip()
    name_line = f"Visitor name: {name}\n" if name else ""
    text = _PERSONA_TEMPLATES[persona].format(name_line=name_line)
    LONG_TERM_MEMORY.write_text(text, encoding="utf-8")
    return persona


def load_persona() -> str:
    content = LONG_TERM_MEMORY.read_text(encoding="utf-8") if LONG_TERM_MEMORY.exists() else ""
    for line in content.splitlines():
        if line.strip().startswith("Persona"):
            return line.split(":", 1)[1].strip()
    return "fun"


def load_profile_text() -> str | None:
    content = LONG_TERM_MEMORY.read_text(encoding="utf-8") if LONG_TERM_MEMORY.exists() else ""
    if not content.strip() or content.strip().startswith("_("):
        return None
    return content
