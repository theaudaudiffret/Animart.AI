"""Couche données Supabase : client (service_role), vérification du JWT et accès aux tables.

Le backend est de confiance : il vérifie le JWT du visiteur (émis par Supabase Auth),
en extrait l'user_id, puis lit/écrit Postgres avec la service_role key — toujours filtré
par cet user_id. La RLS protège en plus contre tout accès direct via la clé anon.

Client **async** (supabase-py) : les requêtes DB sont des appels HTTP courts non bloquants
pour la boucle asyncio → tient une forte concurrence sans threads (cf. objectif 100 users).
"""
import asyncio
import os
from datetime import datetime, timezone
from typing import Any

import jwt
from fastapi import HTTPException, Request
from supabase import AsyncClient, create_async_client

BUCKET = "artwork-assets"


def _rows(res) -> list[Any]:
    """Lignes d'une réponse PostgREST en list[Any] (évite le bruit de typage sur .data)."""
    return res.data or []


def _env(name: str) -> str:
    val = os.environ.get(name)
    if not val:
        raise RuntimeError(f"Variable d'environnement manquante : {name}")
    return val


def base_url() -> str:
    """URL projet Supabase, tolérante à un chemin collé par erreur (.../rest/v1)."""
    url = _env("SUPABASE_URL").rstrip("/")
    for suffix in ("/rest/v1", "/storage/v1", "/auth/v1"):
        if url.endswith(suffix):
            url = url[: -len(suffix)]
    return url


# ─── Client Supabase (service_role), mémoïsé par worker ─────────────────────────

_client: AsyncClient | None = None
_client_lock = asyncio.Lock()


async def service_client() -> AsyncClient:
    global _client
    if _client is None:
        async with _client_lock:
            if _client is None:
                _client = await create_async_client(
                    base_url(), _env("SUPABASE_SERVICE_ROLE_KEY")
                )
    return _client


# ─── Vérification du JWT Supabase ───────────────────────────────────────────────

_jwks: jwt.PyJWKClient | None = None


def _jwks_client() -> jwt.PyJWKClient:
    global _jwks
    if _jwks is None:
        _jwks = jwt.PyJWKClient(f"{base_url()}/auth/v1/.well-known/jwks.json")
    return _jwks


def _verify_jwt(token: str) -> str:
    """Vérifie la signature + l'audience et renvoie l'user_id (claim `sub`)."""
    alg = jwt.get_unverified_header(token).get("alg", "")
    if alg == "HS256":
        # Projets « legacy » (secret JWT symétrique partagé).
        secret = os.environ.get("SUPABASE_JWT_SECRET")
        if not secret:
            raise RuntimeError("JWT HS256 mais SUPABASE_JWT_SECRET non défini")
        payload = jwt.decode(token, secret, algorithms=["HS256"], audience="authenticated")
    else:
        # Projets récents (clés de signature asymétriques exposées via JWKS).
        signing_key = _jwks_client().get_signing_key_from_jwt(token)
        payload = jwt.decode(token, signing_key.key, algorithms=[alg], audience="authenticated")
    sub = payload.get("sub")
    if not sub:
        raise ValueError("JWT sans claim sub")
    return sub


async def current_user(request: Request) -> str:
    """Dépendance FastAPI : exige un `Authorization: Bearer <jwt>` valide → user_id."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = auth[7:].strip()
    try:
        # Vérif en thread : évite que le fetch JWKS (1re fois) ne bloque la boucle.
        return await asyncio.to_thread(_verify_jwt, token)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


# ─── Profils ────────────────────────────────────────────────────────────────────

async def get_profile(user_id: str) -> dict | None:
    c = await service_client()
    res = await c.table("profiles").select("*").eq("id", user_id).limit(1).execute()
    rows = _rows(res)
    return rows[0] if rows else None


async def persona_of(user_id: str) -> str:
    profile = await get_profile(user_id)
    return (profile or {}).get("persona") or "fun"


async def upsert_profile(user_id: str, name: str, persona: str) -> None:
    c = await service_client()
    # name/persona uniquement → journey et created_at sont préservés sur conflit.
    await c.table("profiles").upsert({"id": user_id, "name": name, "persona": persona}).execute()


async def set_journey(user_id: str, journey: dict) -> None:
    c = await service_client()
    await c.table("profiles").upsert({"id": user_id, "journey": journey}).execute()


# ─── Bibliothèque + progression (par utilisateur) ───────────────────────────────

async def get_progress(user_id: str) -> dict[str, int]:
    c = await service_client()
    res = await c.table("progress").select("artist_id,scans").eq("user_id", user_id).execute()
    return {r["artist_id"]: r["scans"] for r in _rows(res)}


async def get_library(user_id: str) -> list[dict]:
    c = await service_client()
    res = (
        await c.table("library").select("*")
        .eq("user_id", user_id).order("created_at", desc=True).execute()
    )
    return _rows(res)


async def library_count(user_id: str) -> int:
    c = await service_client()
    res = await c.table("library").select("key").eq("user_id", user_id).execute()
    return len(_rows(res))


async def in_library(user_id: str, key: str) -> bool:
    c = await service_client()
    res = (
        await c.table("library").select("key")
        .eq("user_id", user_id).eq("key", key).limit(1).execute()
    )
    return bool(_rows(res))


async def add_to_library(user_id: str, persona: str, key: str,
                         titre: str | None, artiste: str | None, artist_id: str | None) -> None:
    c = await service_client()
    await c.table("library").upsert({
        "user_id": user_id, "persona": persona, "key": key,
        "titre": titre, "artiste": artiste, "artist_id": artist_id,
    }).execute()


async def bump_progress(user_id: str, artist_id: str) -> int:
    """Incrémente le compteur de quête de l'artiste et renvoie le nouveau total."""
    c = await service_client()
    res = (
        await c.table("progress").select("scans")
        .eq("user_id", user_id).eq("artist_id", artist_id).limit(1).execute()
    )
    rows = _rows(res)
    new = (rows[0]["scans"] if rows else 0) + 1
    await c.table("progress").upsert(
        {"user_id": user_id, "artist_id": artist_id, "scans": new}
    ).execute()
    return new


# ─── DB persona PARTAGÉE (artworks) ─────────────────────────────────────────────

async def find_artwork(persona: str, key: str) -> dict | None:
    c = await service_client()
    res = (
        await c.table("artworks").select("*")
        .eq("persona", persona).eq("key", key).limit(1).execute()
    )
    rows = _rows(res)
    return rows[0] if rows else None


async def db_entries(persona: str) -> list[dict]:
    """Résumés des œuvres déjà enregistrées, pour l'agent de déduplication."""
    c = await service_client()
    res = (
        await c.table("artworks")
        .select("key,titre_probable,artiste_probable,style,epoque")
        .eq("persona", persona).execute()
    )
    return _rows(res)


async def save_artwork(persona: str, key: str, result: dict, *,
                       has_photo: bool = False, has_audio: bool = False,
                       has_immersive: bool = False, captions=None) -> None:
    c = await service_client()
    row = {
        "persona": persona, "key": key,
        "titre_probable": result.get("titre_probable"),
        "artiste_probable": result.get("artiste_probable"),
        "artist_id": result.get("artist_id"),
        "style": result.get("style"),
        "epoque": result.get("epoque"),
        "data": result,
        "has_photo": has_photo, "has_audio": has_audio, "has_immersive": has_immersive,
    }
    if captions is not None:
        row["captions"] = captions
    await c.table("artworks").upsert(row).execute()


async def update_artwork(persona: str, key: str, fields: dict) -> None:
    c = await service_client()
    await c.table("artworks").update(fields).eq("persona", persona).eq("key", key).execute()


async def artworks_flags(persona: str, keys: list[str]) -> dict[str, dict]:
    """Flags has_photo/has_audio/has_immersive pour un lot de clés (évite le N+1)."""
    if not keys:
        return {}
    c = await service_client()
    res = (
        await c.table("artworks").select("key,has_photo,has_audio,has_immersive")
        .eq("persona", persona).in_("key", keys).execute()
    )
    return {r["key"]: r for r in _rows(res)}


# ─── Garde-fou coût/abus : cap quotidien de scans par utilisateur ───────────────

async def check_and_bump_usage(user_id: str, max_per_day: int) -> bool:
    """Incrémente la conso du jour ; renvoie False si le plafond est atteint."""
    if max_per_day <= 0:
        return True  # illimité
    c = await service_client()
    today = datetime.now(timezone.utc).date().isoformat()
    res = (
        await c.table("usage").select("scans")
        .eq("user_id", user_id).eq("day", today).limit(1).execute()
    )
    rows = _rows(res)
    cur = rows[0]["scans"] if rows else 0
    if cur >= max_per_day:
        return False
    await c.table("usage").upsert({"user_id": user_id, "day": today, "scans": cur + 1}).execute()
    return True
