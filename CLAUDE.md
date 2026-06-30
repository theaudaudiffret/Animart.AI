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
Requires `.env` with `ANTHROPIC_API_KEY` and `ELEVENLABS_API_KEY`. Python ≥ 3.11; deps in `pyproject.toml`.

## Architecture

**Backend** (`backend/`, FastAPI):
- `server.py` — routes (`/profiles`, `/profile`, `/journey`, `/me`, `/analyze`, `/narrate`, `/immersive`, `/library`, `/artwork/{key}`, `/photos/{key}`, `/audio/{key}`, `/immersive-audio/{key}`) + per-user storage helpers. Every request carries the active profile via the `X-Profile-Id` header; asset endpoints (`/photos`, `/audio`, `/immersive-audio`) can't send headers from `<img>`/`Audio`, so they take a `?persona=` query (with a search fallback). `/artwork/{key}` returns the full stored artwork JSON (feeds the library detail modal). Wikipedia image fetch uses async `httpx` + `curl` fallback (upload.wikimedia.org blocks Python TLS).
- `analyzer.py` — Claude vision → artwork JSON (system prompt `docs/prompt.md`, strict `json_schema`).
- `dedup.py` — **Claude dedup agent**: given a new artwork + the persona DB entries, returns the matching `key` or null (semantic match, e.g. "La Joconde" = "Mona Lisa").
- `narrator.py` — Claude narration text (prompt `docs/narration_prompt.md`) → ElevenLabs audio; `narrate(data, profile_text)` takes the visitor's profile text (no global memory file).
- `matcher.py` — maps the detected artist name to a museum/artist id via alias tables (drives quests).
- `profile.py` — the profile is a **demo reduced to 2 personas** (`serious` / `fun`), derived from the onboarding *tone* answer. `build_profile_text(name, persona)` renders the long-term-memory text handed to the narrator; persona/name are stored per-user in `users/{id}/meta.json`.

**Frontend** (`frontend/src/`, React + Vite, inline-style components):
- `api.ts` — active profile id (localStorage `animart-profile-id`) + `api()` fetch wrapper that injects `X-Profile-Id`, plus `assetUrl(path, persona)` for `<img>`/`Audio` srcs.
- `App.tsx` — profile gate (`boot` → `landing` / `onboarding` / `app`) + tab shell + quest progress held in state from `/me`. `PageI` stays mounted (hidden via `display`) so the last analysis survives tab switches; other pages remount to refresh.
- `Landing.tsx` — first screen: brand + how-it-works, pick an existing profile (`/profiles`) or create a new one. `Onboarding.tsx` — two-step profile creation (questionnaire → `/profile`, then journey planner → `/journey`).
- `PageI.tsx` — camera/scan/result flow only (idle home shows greeting + journey + profile switcher).
- `PageII.tsx` — museum/artist quest collection (progress passed as a prop; the journey's target museum is badged). `PageBiblio.tsx` — per-user library; tapping a row opens an artwork detail modal (full photo + époque/technique + description via `/artwork/{key}`) with an in-modal play button. `data.ts` — museums/artists/levels.

## Data model — two decoupled tiers

1. **Persona DB** (`analyses/serious/`, `analyses/fun/`, each with `audio/` + `immersive/` + `photos/` + `{key}.json`): **permanent, shared** cache across all users of that persona. Enables audio reuse. The file `key` is the perceptual hash (`_phash`) of the first photo; the dedup agent matches across different photos of the same work.
2. **User profile** (`users/{id}/` with `meta.json` = name/persona/journey, `session.json` = library, `progress.json` = quest counts): **per-user, isolated**, never touches the persona DBs. The client generates the id and sends it as `X-Profile-Id`.

**Scan flow:** analyze → dedup agent searches the persona DB → match: reuse stored json+audio; no match: save new entry. Library **and** quest progress advance together from the same gate: only if the work's key isn't already in this user's session (`in_session`), independent of audio caching. `/analyze` returns `artist_scans` (the artist's new quest count, or null when nothing was counted) so the UI updates progress without a round-trip.

## Gotchas

- Library + progress are the same source of truth (server, per-user) — gate both on `in_session`, never on `from_cache` (DB hit). `/analyze` increments progress server-side; the frontend mirrors it from `artist_scans`.
- Per-user state survives restarts; there's no global reset — a "new profile" is just a fresh client id (old profiles remain in `users/`).
- Every scan costs an extra Claude call (the dedup agent) once the persona DB is non-empty.