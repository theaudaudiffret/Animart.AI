# Animart.ai 🏛️

Guide de musée mobile : l'utilisateur **photographie une œuvre**, Claude l'analyse, puis l'app propose une **visite audio personnalisée** (narration ou scène immersive) adaptée au profil du visiteur. Quêtes par artiste et bibliothèque de session incluses.

Contenu généré en **anglais**. Les clés JSON d'analyse restent en français (`titre_probable`, `artiste_probable`, …).

---

## Comment ça marche

Diagramme de séquence UML — du scan à l'audio :

```mermaid
sequenceDiagram
  autonumber
  actor Visiteur
  participant PageI as PageI.tsx
  participant Server as server.py
  participant Analyzer as analyzer.py
  participant Dedup as dedup.py
  participant Narrator as narrator.py
  participant Immersive as immersive.py
  participant Claude as Claude API
  participant ElevenLabs as ElevenLabs API
  participant Cache as analyses persona DB

  Visiteur->>PageI: Photographier une oeuvre
  PageI->>Server: POST /analyze
  Server->>Analyzer: analyze_artwork()
  Analyzer->>Claude: vision + prompt.md
  Claude-->>Analyzer: JSON oeuvre
  Analyzer-->>Server: metadata
  Server->>Dedup: find_existing_artwork()
  Dedup->>Claude: matching semantique
  Claude-->>Dedup: key ou null
  alt cache hit
    Server->>Cache: charger JSON existant
  else nouvelle oeuvre
    Server->>Cache: sauver JSON + photo
  end
  Server-->>PageI: artwork + from_cache + in_session

  alt narration
    Visiteur->>PageI: Ecouter narration
    PageI->>Server: POST /narrate
    Server->>Narrator: narrate()
    Narrator->>Claude: script personnalise
    Narrator->>ElevenLabs: TTS
    Narrator->>Cache: sauver audio/
    Server-->>PageI: MP3
  else scene immersive
    Visiteur->>PageI: Scene immersive
    PageI->>Server: POST /immersive
    Server->>Immersive: generate_immersive()
    Immersive->>Claude: script multi-voix
    Immersive->>ElevenLabs: dialogue + musique + SFX
    Immersive->>Cache: sauver immersive/
    Server-->>PageI: MP3 + captions
  end
```

Le profil visiteur (questionnaire → persona `serious` / `fun`) est stocké dans `docs/long_term_memory.md` et pilote le ton de la narration. Les œuvres scannées sont mises en cache dans `analyses/{persona}/` ; la session courante vit dans `docs/session.json`.

### Diagramme de composants (UML)

Relations entre packages et fichiers du dépôt :

```mermaid
classDiagram
  direction TB

  class App_tsx <<component>>
  class PageI_tsx <<component>>
  class PageII_tsx <<component>>
  class PageBiblio_tsx <<component>>
  class data_ts <<component>>
  class cityData_ts <<component>>

  class server_py <<component>>
  class analyzer_py <<component>>
  class dedup_py <<component>>
  class matcher_py <<component>>
  class profile_py <<component>>
  class narrator_py <<component>>
  class immersive_py <<component>>

  class pipeline_py <<component>>
  class prompts_py <<component>>
  class voice_catalog <<component>>

  class prompt_md <<artifact>>
  class narration_md <<artifact>>
  class longterm_md <<artifact>>
  class session_json <<artifact>>
  class persona_db <<database>>

  class ClaudeAPI <<external>>
  class ElevenLabsAPI <<external>>
  class WikipediaAPI <<external>>

  App_tsx --> PageI_tsx : contient
  App_tsx --> PageII_tsx : contient
  App_tsx --> PageBiblio_tsx : contient
  PageI_tsx ..> data_ts : import
  PageI_tsx ..> cityData_ts : import
  PageII_tsx ..> data_ts : import
  PageBiblio_tsx ..> data_ts : import

  PageI_tsx ..> server_py : HTTP REST
  PageII_tsx ..> server_py : HTTP REST
  PageBiblio_tsx ..> server_py : HTTP REST

  server_py --> analyzer_py : appelle
  server_py --> dedup_py : appelle
  server_py --> matcher_py : appelle
  server_py --> profile_py : appelle
  server_py --> narrator_py : appelle
  server_py --> immersive_py : appelle
  server_py --> persona_db : read write
  server_py --> session_json : read write

  analyzer_py ..> prompt_md : lit
  analyzer_py ..> ClaudeAPI : vision
  dedup_py ..> ClaudeAPI : dedup
  profile_py ..> longterm_md : ecrit
  narrator_py ..> narration_md : lit
  narrator_py ..> longterm_md : lit
  narrator_py ..> ClaudeAPI : script
  narrator_py ..> ElevenLabsAPI : TTS
  server_py ..> WikipediaAPI : photo oeuvre

  immersive_py --> pipeline_py : delegue
  pipeline_py --> prompts_py : utilise
  pipeline_py ..> voice_catalog : casting
  pipeline_py ..> ClaudeAPI : script scene
  pipeline_py ..> ElevenLabsAPI : audio immersif
  immersive_py ..> persona_db : cache MP3
  narrator_py ..> persona_db : cache MP3
```

---

## Setup

```bash
uv sync                       # installe les deps Python
cd frontend && npm install    # deps frontend
```

Crée un `.env` à la racine :

```env
ANTHROPIC_API_KEY=sk-ant-...
ELEVENLABS_API_KEY=sk_...
```

`ffmpeg` doit être installé sur la machine (audio immersif). Python ≥ 3.11.

---

## Lancer

```bash
cd frontend && npm run build   # une fois, ou après chaque modif UI
cd ..
uv run python -m backend.server
```

Le serveur écoute sur le **port 8000** et affiche une URL LAN pour le téléphone (même Wi‑Fi).

Optionnel — analyser une image en CLI :

```bash
uv run python -m backend.main chemin/vers/photo.jpg
```

Optionnel — synchroniser le catalogue de voix ElevenLabs :

```bash
uv run python -m immersive_scene.sync_voices
```

---

## Fichiers

| Fichier / dossier | Rôle |
|---|---|
| `backend/server.py` | API FastAPI, routes, fichiers statiques (`frontend/dist`) |
| `backend/analyzer.py` | Claude vision → JSON œuvre |
| `backend/dedup.py` | Agent Claude : même œuvre ou nouvelle entrée |
| `backend/narrator.py` | Script Claude + TTS ElevenLabs |
| `backend/immersive.py` | Pont vers la scène immersive |
| `backend/matcher.py` | Nom d'artiste → id musée / quête |
| `backend/profile.py` | Questionnaire → persona |
| `frontend/src/PageI.tsx` | Onboarding, scan, résultat audio |
| `frontend/src/PageII.tsx` | Quêtes (Louvre, Orsay, Pompidou) |
| `frontend/src/PageBiblio.tsx` | Bibliothèque de la session |
| `immersive_scene/` | Pipeline audio immersif multi-voix |
| `analyses/{serious,fun}/` | Cache partagé par persona (JSON, photos, audio) |
| `docs/prompt.md` | Prompt d'analyse vision |
| `docs/narration_prompt.md` | Prompt de narration |

---

## Routes API

| Méthode | Route | Description |
|---|---|---|
| `POST` | `/profile` | Enregistre le profil visiteur |
| `POST` | `/new-profile` | Reset session (cache persona intact) |
| `POST` | `/analyze` | Photo → JSON œuvre |
| `POST` | `/narrate` | Narration MP3 |
| `POST` | `/immersive` | Scène immersive MP3 + sous-titres |
| `GET` | `/library` | Bibliothèque session |
| `GET` | `/artwork/{key}` | JSON complet d'une œuvre |
| `GET` | `/photos/{key}` · `/audio/{key}` · `/immersive-audio/{key}` | Médias |

---

## À savoir

- Seul `/new-profile` efface la session ; le cache `analyses/` persiste.
- Chaque scan peut déclencher un appel Claude de dédup si le cache n'est pas vide.
- Narration et immersif sont **deux modes distincts** — le visiteur en choisit un par œuvre.
