# immersive_scene

Génère une scène audio immersive autonome à partir d'un nom de tableau + d'infos dessus : **pas de narration de guide** — juste la scène elle-même. Deux textures d'ambiance + musique de fond (dynamiquement abaissées pendant la voix — "ducking"), un dialogue théâtral multi-voix avec tags d'émotion et effets sonores ponctuels synchronisés, le tout mixé en un seul `.mp3` avec une courte ouverture/fermeture cinématique. Renvoie aussi les sous-titres synchronisés mot par mot.

C'est volontairement une expérience distincte du narrateur classique (côté app hôte, voir `backend/narrator.py`) : le visiteur choisit l'un ou l'autre, pas les deux à la suite.

Package autonome, pensé pour être copié tel quel dans un autre repo comme fonctionnalité additionnelle.

## Voix

Les voix anglophones ajoutées à ElevenLabs **My Voices** sont importées dans `voice_catalog.json`. Claude utilise leurs descriptions, âge, genre et accent pour caster chaque personnage du tableau. Un personnage conserve ensuite la même voix pendant toute la scène.

Pour rafraîchir le catalogue après avoir ajouté ou supprimé des voix :

```bash
uv run python3 -m immersive_scene.sync_voices
```

La clé ElevenLabs doit avoir la permission `voices_read`.

Le dialogue entre personnages part en un seul appel à `client.text_to_dialogue.convert(...)` (API native multi-voix d'ElevenLabs) plutôt qu'un appel TTS par ligne. Chaque ligne peut contenir des tags d'émotion ElevenLabs inline (ex: `[chuchote]`, `[rit]`) écrits par Claude pour une livraison plus expressive.

## Sound design

- **2 textures d'ambiance** continues et simples (pas un seul soundscape généraliste — une texture qui mélange plusieurs sons distincts sonne mauvais ; deux textures focalisées, superposées, donnent plus de profondeur sans bouillie).
- **Musique de fond** instrumentale (`client.music.compose`, `force_instrumental=True`).
- **Effets sonores ponctuels** : Claude flague au plus 2-3 répliques avec une action sonore précise (`sound_cue`), placées dans le mix à l'instant exact de la réplique (calculé via `forced_alignment`, pas de timing manuel).
- **Ducking** : textures + musique baissent automatiquement pendant le dialogue, remontent pendant l'intro/outro.
- **Structure** : ~2.5s d'ambiance seule avant que le dialogue démarre, ~4s de tail en fondu à la fin.

## Sous-titres

`generate_immersive_scene` renvoie aussi des sous-titres mot par mot du dialogue (`forced_alignment.create`), avec leurs timestamps déjà alignés sur le fichier audio final exporté (donc directement utilisables côté frontend sans recalcul).

## Setup

```bash
pip install anthropic elevenlabs pydub python-dotenv pydantic
```

Variables d'environnement requises (`.env` ou export) :

```
ANTHROPIC_API_KEY=...
ELEVENLABS_API_KEY=...
```

`ffmpeg` doit être installé sur la machine (utilisé par pydub pour décoder/encoder les formats audio).

## Usage

```python
from immersive_scene import generate_immersive_scene

path, captions = generate_immersive_scene(
    "La liberté guidant le peuple",
    "Tableau d'Eugène Delacroix (1830), Révolution de Juillet à Paris...",
    artist_name="Eugène Delacroix",
)
print(path)      # outputs/la_liberte_guidant_le_peuple/final_scene.mp3
print(captions)  # [{"text": "Le", "start": 2.5, "end": 2.7}, ...]
```

Le pipeline ne reçoit volontairement aucun texte de narrateur : Claude travaille directement depuis les informations factuelles de l'œuvre afin d'éviter que le dialogue imite une voix de guide. Il ne fait qu'un seul appel Claude au total pour générer textures, musique, casting et dialogue.

## Fichiers

- `pipeline.py` — point d'entrée `generate_immersive_scene(...)` ; orchestre génération parallèle (ElevenLabs), alignement/sous-titres, ducking, et mix final
- `prompts.py` — builders de prompts (description de contexte ; textures+musique+dialogue combinés ; pas d'appel API)
- `claude_client.py` — appels Claude (`claude-sonnet-4-6`) : texte simple + sortie structurée Pydantic
- `elevenlabs_client.py` — dialogue multi-voix, sound effects (avec boucle native), musique
- `voices.py` — charge et valide le catalogue de voix anglophones
- `sync_voices.py` — importe les voix de My Voices et leurs descriptions
- `voice_catalog.json` — dataset local utilisé pour le casting automatique
- `audio.py` — assemblage pydub (boucle, mix, normalisation, encodage)

## Hors scope (pour l'instant)

- Profil visiteur (âge/ton) non câblé sur cette partie — le dialogue et la musique restent en `"English"/"adult"` génériques, alors que la narration simple (côté app hôte) en tient déjà compte.
- Panning stéréo par personnage.
- Effet visuel (Ken Burns) sur l'image pendant la lecture — feature frontend, pas ce package.
- Pas de pipeline Q&A vocal live (feature séparée).
