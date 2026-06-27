from pathlib import Path

ROOT = Path(__file__).parent.parent
PROFILE_DIR = ROOT / "profil"
PROFILE_PATH = PROFILE_DIR / "visiteur.md"


def save_profile(data: dict) -> None:
    PROFILE_DIR.mkdir(exist_ok=True)
    interests = data.get("interests") or []
    lines = [
        "# Profil du visiteur",
        "",
        f"- Tranche d'âge : {data.get('age_range') or '—'}",
        f"- Niveau en art : {data.get('level') or '—'}",
        f"- Centres d'intérêt : {', '.join(interests) if interests else '—'}",
        f"- Ton souhaité : {data.get('tone') or '—'}",
    ]
    PROFILE_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def load_profile_text() -> str | None:
    if not PROFILE_PATH.exists():
        return None
    return PROFILE_PATH.read_text(encoding="utf-8")
