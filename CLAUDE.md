# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

# Project: Musées

A mobile-first museum guide. The visitor photographs an artwork; Claude analyzes it and ElevenLabs narrates a short audio commentary adapted to the visitor's persona. Gamified with per-museum artist "quests" and a personal library.

**All generated content (analysis values + narration audio) is in English.** The JSON *field names* are French (`titre_probable`, `artiste_probable`, `couleurs_dominantes`, `ambiance`, `sujets`, `epoque`, `technique`) — internal schema keys, do not confuse with output language.

## Run

```bash
cd frontend && npm run build      # build the React app first (server serves frontend/dist)
python -m backend.server          # FastAPI + uvicorn on :8000, prints the LAN URL for phone access
```
Requires `.env` (see `.env.example`): `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (backend) + `frontend/.env` with `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`. First-time Supabase setup + prod deploy (Dockerfile, gunicorn) are in `README.md`; schema in `supabase/migrations/0001_init.sql`. Python ≥ 3.11; deps in `pyproject.toml`.

## Architecture

**Backend** (`backend/`, FastAPI):
- `server.py` — routes (`/health`, `/profile`, `/journey`, `/me`, `/analyze`, `/narrate`, `/immersive`, `/library`, `/artwork/{key}`, `/photos/{key}`, `/audio/{key}`, `/immersive-audio/{key}`). All data routes depend on `supa.current_user` (verifies the `Authorization: Bearer <JWT>` → user_id). `/narrate` & `/immersive` return `{audio_url}` (CDN, with captions for immersive), not raw bytes. Asset endpoints can't send headers from `<img>`/`Audio`, so they take a `?persona=` query and **307-redirect to the Storage CDN** (no bytes through the backend). Wikipedia image fetch uses async `httpx` + `curl` fallback (upload.wikimedia.org blocks Python TLS). CORS, daily scan cap (`MAX_SCANS_PER_DAY`), immersive semaphore (`MAX_CONCURRENT_IMMERSIVE`) and the thread-pool size (`THREAD_LIMIT`) are env-driven.
- `supa.py` — Supabase: async service-role client (mémoïsé), `current_user` JWT verification (JWKS, HS256 fallback via `SUPABASE_JWT_SECRET`), and all DB access (profiles / artworks / library / progress / usage). `storage.py` — upload to + public CDN URLs for the `artwork-assets` bucket.
- `analyzer.py` — Claude vision → artwork JSON (system prompt `docs/prompt.md`, strict `json_schema`).
- `dedup.py` — **Claude dedup agent**: given a new artwork + the persona DB entries, returns the matching `key` or null (semantic match, e.g. "La Joconde" = "Mona Lisa").
- `narrator.py` — Claude narration text (prompt `docs/narration_prompt.md`) → ElevenLabs audio; `narrate(data, profile_text)` takes the visitor's profile text (no global memory file).
- `matcher.py` — maps the detected artist name to a museum/artist id via alias tables (drives quests).
- `profile.py` — the profile is a **demo reduced to 2 personas** (`serious` / `fun`), derived from the onboarding *tone* answer. `build_profile_text(name, persona)` renders the long-term-memory text handed to the narrator; persona/name are stored per-user in the `profiles` table.

**Frontend** (`frontend/src/`, React + Vite, inline-style components):
- `api.ts` — Supabase client (auth only) + `api()` fetch wrapper that attaches `Authorization: Bearer <access_token>`, `signUp`/`signIn`/`signOut`/`getSession`, plus `assetUrl(path, persona)` for `<img>`/`Audio` srcs.
- `App.tsx` — auth gate driven by `supabase.auth.onAuthStateChange` (`boot` → `landing` / `auth` / `onboarding` / `app`); the profile is loaded from `/me` (no persona ⇒ onboarding). Tab shell + quest progress in state. `PageI` stays mounted (hidden via `display`) so the last analysis survives tab switches; other pages remount to refresh.
- `Landing.tsx` — brand + how-it-works → `Auth.tsx` (email+password sign in / sign up). `Onboarding.tsx` — two-step profile creation (questionnaire → `/profile`, then journey planner → `/journey`).
- `PageI.tsx` — camera/scan/result flow only (idle home shows greeting + journey + **Sign out**).
- `PageII.tsx` — museum/artist quest collection (progress passed as a prop; the journey's target museum is badged). `PageBiblio.tsx` — per-user library; tapping a row opens an artwork detail modal (full photo + époque/technique + description via `/artwork/{key}`) with an in-modal play button. `data.ts` — museums/artists/levels.

## Data model — two decoupled tiers (Supabase Postgres + Storage)

1. **Persona DB** — shared `artworks` table keyed by `(persona, key)`, plus assets in the public `artwork-assets` Storage bucket (`{photos,audio,immersive}/{persona}/{key}.ext`); immersive captions live in `artworks.captions`. **Permanent, shared** cache across all users of a persona (enables audio reuse). The `key` is the perceptual hash (`_phash`) of the first photo; the dedup agent matches across different photos of the same work.
2. **User data** — `profiles` (name/persona/journey), `library` (the collection), `progress` (quest counts), `usage` (daily scan cap), all keyed by `auth.users.id`. **Per-user, isolated** by Row Level Security; never touches the shared `artworks`. Identity comes from the verified Supabase JWT, not a client-supplied id.

The backend uses the **service_role** key (bypasses RLS) but always filters/writes by the JWT's `user_id`; RLS is the second line of defense against direct anon-key access.

**Scan flow:** analyze → dedup agent searches the persona DB → match: reuse stored json+audio; no match: save new `artworks` row. Library **and** quest progress advance together from the same gate: only if the work's key isn't already in this user's `library` (`in_session`), independent of audio caching. `/analyze` returns `artist_scans` (the artist's new quest count, or null when nothing was counted) so the UI updates progress without a round-trip.

## Gotchas

- Library + progress are the same source of truth (per-user tables) — gate both on `in_session`, never on `from_cache` (DB hit). `/analyze` increments progress server-side; the frontend mirrors it from `artist_scans`.
- Backend is **stateless** (state in Supabase) → run multiple workers/replicas; never store per-request state in process memory.
- One account = one visitor; there's no on-device profile switcher anymore — *Sign out* replaces it. Auth is real (Supabase email+password); `/me` with a null persona ⇒ onboarding.
- Every scan costs an extra Claude call (the dedup agent) once the persona DB is non-empty.
- `analyses/` and `users/` on disk are **legacy** (pre-Supabase); the cache is imported once via `scripts/import_cache.py`, after which only Supabase is read/written.