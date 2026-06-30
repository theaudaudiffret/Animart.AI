"""Importe le cache fichiers (analyses/) dans Supabase (Postgres + Storage).

À lancer une fois, après la migration SQL, avec SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
dans l'env (.env) :

    python -m scripts.import_cache

Idempotent (upsert) : relançable sans créer de doublons. Les dossiers users/ ne sont
PAS migrés (ils n'ont pas d'identité auth réelle).
"""
import asyncio
import json
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from backend import storage, supa  # noqa: E402  (après load_dotenv)

ROOT = Path(__file__).parent.parent
ANALYSES = ROOT / "analyses"


async def _import_persona(persona: str) -> int:
    pdir = ANALYSES / persona
    if not pdir.is_dir():
        return 0

    count = 0
    for jf in sorted(pdir.glob("*.json")):
        data = json.loads(jf.read_text(encoding="utf-8"))
        key = data.get("_key")
        if not key:
            print(f"  [{persona}] {jf.name} sans _key → ignoré")
            continue

        photo = pdir / "photos" / f"{key}.jpg"
        audio = pdir / "audio" / f"{key}.mp3"
        immersive = pdir / "immersive" / f"{key}.mp3"
        captions_file = pdir / "immersive" / f"{key}.captions.json"
        captions = json.loads(captions_file.read_text(encoding="utf-8")) if captions_file.exists() else None

        await supa.save_artwork(
            persona, key, data,
            has_photo=photo.exists(),
            has_audio=audio.exists(),
            has_immersive=immersive.exists(),
            captions=captions,
        )
        if photo.exists():
            await storage.upload(persona, "photos", key, photo.read_bytes())
        if audio.exists():
            await storage.upload(persona, "audio", key, audio.read_bytes())
        if immersive.exists():
            await storage.upload(persona, "immersive", key, immersive.read_bytes())

        count += 1
        print(f"  [{persona}] {key}  {data.get('titre_probable') or '—'}")
    return count


async def main() -> None:
    total = 0
    for persona in ("serious", "fun"):
        total += await _import_persona(persona)
    print(f"\n✓ {total} œuvre(s) importée(s) dans Supabase.")


if __name__ == "__main__":
    asyncio.run(main())
