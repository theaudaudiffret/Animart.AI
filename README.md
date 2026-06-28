# Musées — AI museum guide

Mobile-first web app for museum visits. A visitor photographs an artwork; **Claude** analyzes it and produces structured metadata. The app then offers two audio experiences — a **personalized narration** or an **immersive scene** — via **ElevenLabs**, adapted to a visitor persona. Gamification tracks artist **quests** and builds a personal **library** of scanned works.

All generated text and audio is in **English**. JSON field names in the analysis schema are French (`titre_probable`, `artiste_probable`, …) — internal keys only.

---

## Features

- **Onboarding** — short questionnaire → visitor profile (demo: two personas, `serious` / `fun`, driven by tone choice)
- **City & museum journey** — pick a city, museum, era, or featured artist before scanning (`cityData.ts`: Paris, London, Amsterdam, Madrid, Florence, New York, Rome, …)
- **Artwork scan** — camera upload, client-side resize, Claude vision analysis
- **Semantic dedup** — Claude agent matches new scans to existing works (e.g. *Mona Lisa* = *La Joconde*)
- **Classic narration** — Claude writes the script, ElevenLabs speaks it (persona-aware)
- **Immersive scene** — multi-voice theatrical audio with ambient textures, music, SFX, and word-level captions (`immersive_scene/`)
- **Quests** — scan progress per artist at the Louvre, Orsay, and Pompidou (`PageII`, `data.ts`)
- **Library** — session artworks grouped by museum, detail modal, audio playback (`PageBiblio`)

---

## Stack

| Layer | Technology |
|-------|------------|
| Backend | Python 3.11+, FastAPI, Uvicorn |
| Frontend | React 19, Vite, TypeScript |
| Vision / text | Anthropic Claude (`analyzer`, `dedup`, `narrator`, immersive script) |
| Audio | ElevenLabs (TTS, multi-voice dialogue, music, SFX) |
| Images | OpenCV (resize, perceptual hash), Wikipedia API |
| Deps | [uv](https://docs.astral.sh/uv/) + `pyproject.toml` / `uv.lock` |

---

## Architecture

### System context

```mermaid
flowchart LR
  Browser["Browser\n(React SPA)"]
  FastAPI["backend/server.py\nFastAPI + frontend/dist"]
  Claude["Anthropic Claude"]
  ElevenLabs["ElevenLabs"]
  Wikipedia["Wikipedia API"]

  Browser <-->|HTTP| FastAPI
  FastAPI --> Claude
  FastAPI --> ElevenLabs
  FastAPI --> Wikipedia
```

### Module map

Relationships between the main source files. Prompts live in `docs/`; runtime data in `analyses/` and `docs/session.json`.

```mermaid
flowchart TB
  subgraph frontend["frontend/src"]
    App["App.tsx"]
    PageI["PageI.tsx"]
    PageII["PageII.tsx"]
    PageBiblio["PageBiblio.tsx"]
    data["data.ts"]
    cityData["cityData.ts"]
    types["types.ts"]
    App --> PageI & PageII & PageBiblio
    PageI --> data & cityData & types
    PageII --> data
    PageBiblio --> data
  end

  subgraph backend["backend/"]
    server["server.py"]
    analyzer["analyzer.py"]
    dedup["dedup.py"]
    narrator["narrator.py"]
    immersive["immersive.py"]
    matcher["matcher.py"]
    profile["profile.py"]
    main_cli["main.py\n(optional CLI)"]
    server --> analyzer & dedup & narrator & immersive & matcher & profile
    main_cli --> analyzer
  end

  subgraph immersive_pkg["immersive_scene/"]
    pipeline["pipeline.py"]
    prompts["prompts.py"]
    voices["voices.py · voice_catalog.json"]
    pipeline --> prompts & voices
  end

  subgraph docs["docs/"]
    prompt_md["prompt.md"]
    narration_md["narration_prompt.md"]
    session["session.json"]
    longterm["long_term_memory.md"]
  end

  subgraph storage["analyses/{serious,fun}/"]
    json["{key}.json"]
    photos["photos/"]
    audio["audio/"]
    imm["immersive/"]
  end

  PageI & PageII & PageBiblio -->|HTTP| server
  analyzer --> prompt_md
  narrator --> narration_md & longterm
  profile --> longterm
  immersive --> pipeline
  server --> storage & session & longterm
```

### Scan flow

```mermaid
sequenceDiagram
  actor User
  participant PageI as PageI.tsx
  participant API as server.py
  participant Vision as analyzer.py
  participant Dedup as dedup.py
  participant Match as matcher.py
  participant DB as analyses/{persona}/
  participant Session as session.json

  User->>PageI: Take photo
  PageI->>API: POST /analyze
  API->>Vision: analyze_artwork()
  Vision-->>API: artwork JSON
  API->>Match: match_artist()
  API->>Dedup: find_existing_artwork()
  alt persona DB hit
    Dedup-->>API: existing key
    API->>DB: load cached JSON
  else new work
    Dedup-->>API: null
    API->>DB: save {key}.json + photo
  end
  API->>Session: append if not in_session
  API-->>PageI: JSON + from_cache + in_session + artist_id
  User->>PageI: Narrate or immersive
  PageI->>API: POST /narrate or /immersive
  API->>DB: reuse or generate audio
  API-->>PageI: MP3 (+ captions if immersive)
```

### Data model

Two decoupled tiers: a **shared persona cache** and a **per-visitor session**.

```mermaid
flowchart TB
  subgraph persona_db["Persona DB — shared, persistent"]
    P1["analyses/serious/"]
    P2["analyses/fun/"]
  end

  subgraph user_session["User session — cleared by POST /new-profile"]
    S["docs/session.json"]
    L["docs/long_term_memory.md"]
  end

  Scan["New scan"] --> persona_db
  Scan --> user_session
  persona_db -.->|from_cache| Scan
  user_session -.->|in_session| Scan
```

| Flag | Meaning |
|------|---------|
| `from_cache` | Artwork JSON (and audio) reused from the persona DB |
| `in_session` | User already scanned this work — quests/library skip it |

Quest progress uses **`in_session`**, not `from_cache`: cache hits still count as new discoveries for this visitor.

---

## Project layout

```
GENZ_MUSEUM/
├── backend/
│   ├── server.py          # FastAPI app, routes, static files
│   ├── analyzer.py        # Claude vision → artwork JSON
│   ├── dedup.py           # Claude dedup agent
│   ├── narrator.py        # Claude narration → ElevenLabs TTS
│   ├── immersive.py       # Bridge to immersive_scene
│   ├── matcher.py         # Artist name → museum/artist id
│   ├── profile.py         # Onboarding → persona
│   └── main.py            # Optional CLI: analyze a single image file
├── frontend/src/          # React UI (PageI · PageII · PageBiblio)
├── immersive_scene/       # Immersive audio pipeline
├── analyses/{serious,fun}/  # Persona DB (runtime, may be populated)
├── docs/                  # Prompts + session memory
├── pyproject.toml
└── uv.lock
```

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| Python ≥ 3.11 | |
| [uv](https://docs.astral.sh/uv/) | recommended |
| Node.js | frontend build |
| **ffmpeg** | system binary, required for immersive audio |
| `.env` | API keys (see below) |

---

## Quick start

### 1. Clone and configure

```bash
git clone https://github.com/theaudaudiffret/GENZ_MUSEUM.git
cd GENZ_MUSEUM
```

Create `.env` at the repo root:

```env
ANTHROPIC_API_KEY=sk-ant-...
ELEVENLABS_API_KEY=sk_...
```

### 2. Install Python dependencies

```bash
uv sync
```

### 3. Build the frontend

The server serves `frontend/dist/` — rebuild after any UI change.

```bash
cd frontend
npm install
npm run build
cd ..
```

### 4. Run the server

```bash
uv run python -m backend.server
```

Uvicorn binds to **port 8000** (`0.0.0.0`) and prints a LAN URL for phone access on the same Wi‑Fi.

Without uv:

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e .
python -m backend.server
```

### 5. (Optional) Analyze one image from the CLI

```bash
uv run python -m backend.main path/to/photo.jpg
```

### 6. (Optional) Sync ElevenLabs voices for immersive casting

```bash
uv run python -m immersive_scene.sync_voices
```

See [`immersive_scene/README.md`](immersive_scene/README.md).

---

## API routes

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/profile` | Save onboarding → persona |
| `POST` | `/new-profile` | Reset session (persona DB untouched) |
| `POST` | `/analyze` | Upload photo → artwork JSON |
| `POST` | `/narrate` | Cached or new narration MP3 |
| `POST` | `/immersive` | Cached or new immersive MP3 + captions |
| `GET` | `/library` | Session library |
| `GET` | `/artwork/{key}` | Full artwork JSON |
| `GET` | `/photos/{key}` | Artwork image |
| `GET` | `/audio/{key}` | Narration MP3 |
| `GET` | `/immersive-audio/{key}` | Immersive MP3 |

Static assets from `frontend/dist/` are served at `/`.

---

## Further reading

| Document | Contents |
|----------|----------|
| [`immersive_scene/README.md`](immersive_scene/README.md) | Immersive pipeline, voices, sound design |
| [`docs/prompt.md`](docs/prompt.md) | Vision analysis prompt |
| [`docs/narration_prompt.md`](docs/narration_prompt.md) | Narration prompt |
| [`CLAUDE.md`](CLAUDE.md) | Contributor / agent notes |

---

## Gotchas

- Session data survives server restarts; only `/new-profile` clears it.
- Each scan may trigger an extra Claude dedup call once the persona DB is non-empty.
- Wikipedia thumbnails use `httpx` with a `curl` fallback (upload.wikimedia.org blocks Python TLS).
- Narration and immersive are separate modes — the visitor chooses one per artwork.
