from pathlib import Path

ROOT = Path(__file__).parent.parent
LONG_TERM_MEMORY = ROOT / "docs" / "long_term_memory.md"


def save_profile(data: dict) -> None:
    interests = data.get("interests") or []
    lines = [
        "# Mémoire long terme — Profil du visiteur",
        "",
        f"- Langue : {data.get('language') or 'Français'}",
        f"- Tranche d'âge : {data.get('age_range') or '—'}",
        f"- Niveau en art : {data.get('level') or '—'}",
        f"- Centres d'intérêt : {', '.join(interests) if interests else '—'}",
        f"- Ton souhaité : {data.get('tone') or '—'}",
    ]
    LONG_TERM_MEMORY.write_text("\n".join(lines) + "\n", encoding="utf-8")


def load_profile_text() -> str | None:
    content = LONG_TERM_MEMORY.read_text(encoding="utf-8") if LONG_TERM_MEMORY.exists() else ""
    if not content.strip() or content.strip().startswith("_("):
        return None
    return content
