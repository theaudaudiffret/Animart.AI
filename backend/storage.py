"""Assets dans Supabase Storage (bucket public `artwork-assets`).

Chemins : `{kind}/{persona}/{key}.{ext}` avec kind ∈ {photos, audio, immersive}.
La lecture passe par l'URL publique (CDN) ; l'écriture par le backend (service_role).
"""
from . import supa

_EXT = {"photos": "jpg", "audio": "mp3", "immersive": "mp3"}
_CONTENT_TYPE = {"photos": "image/jpeg", "audio": "audio/mpeg", "immersive": "audio/mpeg"}


def _path(persona: str, kind: str, key: str) -> str:
    return f"{kind}/{persona}/{key}.{_EXT[kind]}"


def public_url(persona: str, kind: str, key: str) -> str:
    """URL publique CDN de l'asset (sert aussi pour les redirects des endpoints assets)."""
    return f"{supa.base_url()}/storage/v1/object/public/{supa.BUCKET}/{_path(persona, kind, key)}"


async def upload(persona: str, kind: str, key: str, data: bytes) -> None:
    """Upload (ou écrase via upsert) un asset dans le bucket."""
    client = await supa.service_client()
    await client.storage.from_(supa.BUCKET).upload(
        _path(persona, kind, key),
        data,
        {"content-type": _CONTENT_TYPE[kind], "upsert": "true", "cache-control": "3600"},
    )
