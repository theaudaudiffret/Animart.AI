# Monolithe : un seul conteneur FastAPI qui sert aussi le SPA React buildé.
# Backend stateless (état dans Supabase) → scalable horizontalement (workers + réplicas).

# ── 1. Build du frontend ─────────────────────────────────────────────────────────
FROM node:22-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
# Variables publiques Vite, injectées au build (passées en --build-arg).
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
RUN npm run build

# ── 2. Backend Python ────────────────────────────────────────────────────────────
FROM python:3.11-slim AS backend
ENV PYTHONUNBUFFERED=1
# ffmpeg : pydub (scènes immersives) · curl : fetch image Wikipedia · libglib : opencv-headless
RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg curl libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir uv

WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY backend/ ./backend/
COPY immersive_scene/ ./immersive_scene/
COPY docs/ ./docs/
COPY --from=frontend /app/frontend/dist ./frontend/dist

ENV PORT=8000 WEB_CONCURRENCY=4
EXPOSE 8000
# Workers multiples (stateless) ; timeout large car narrate/immersive sont lents.
CMD ["sh", "-c", "uv run gunicorn backend.server:app -k uvicorn.workers.UvicornWorker -w ${WEB_CONCURRENCY} -b 0.0.0.0:${PORT} --timeout 180"]
