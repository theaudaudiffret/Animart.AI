# Musées — Analyse d'œuvre d'art

Application mobile-first : l'utilisateur photographie une œuvre d'art et obtient instantanément un résumé structuré généré par IA.

## Fonctionnement

1. L'utilisateur ouvre l'URL sur son téléphone (même réseau WiFi que le serveur)
2. Il appuie sur "Prendre une photo" et vise l'œuvre
3. L'image est redimensionnée côté client (max 1600 px) avant envoi
4. Le backend envoie l'image à Claude avec le prompt défini dans `docs/prompt.md`
5. La réponse JSON est affichée sur l'écran et sauvegardée dans `analyses/`

## Stack

| Couche     | Techno                              |
|------------|-------------------------------------|
| Backend    | Python, FastAPI, Anthropic SDK      |
| Frontend   | React 19, Vite, TypeScript          |
| Modèle IA  | Claude Opus 4.8 (vision)            |
| Résultats  | JSON horodatés dans `analyses/`     |

## Lancer l'app

```bash
# 1. Build frontend (une fois, ou après chaque modif React)
cd frontend && npm run build && cd ..

# 2. Démarrer le serveur (affiche l'URL à ouvrir sur le téléphone)
python3 backend/server.py
```

## Structure du projet

```
musees/
├── backend/        # API FastAPI + logique d'analyse Claude
├── frontend/       # Interface React + Vite (TypeScript)
├── analyses/       # Résultats JSON sauvegardés automatiquement
└── docs/
    ├── app.md      # Ce fichier
    └── prompt.md   # Prompt système envoyé à Claude
```
