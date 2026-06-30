-- Musées / Animart.ai — schéma initial Supabase
-- Deux tiers découplés : DB persona PARTAGÉE (cache d'analyses) + données PAR UTILISATEUR.
-- La RLS isole chaque utilisateur ; le backend (service_role) bypasse la RLS mais
-- filtre toujours par l'user_id vérifié dans le JWT.

-- ─── Profils (1 ligne par compte auth) ──────────────────────────────────────────
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text,
  persona    text not null default 'fun' check (persona in ('serious', 'fun')),
  journey    jsonb,
  created_at timestamptz not null default now()
);

-- ─── DB persona PARTAGÉE — le cache d'analyses. Clé = (persona, key=phash) ───────
create table if not exists public.artworks (
  persona          text not null check (persona in ('serious', 'fun')),
  key              text not null,
  titre_probable   text,
  artiste_probable text,
  artist_id        text,
  style            text,
  epoque           text,
  data             jsonb not null,            -- json d'analyse complet
  captions         jsonb,                     -- captions immersive (remplace .captions.json)
  has_photo        boolean not null default false,
  has_audio        boolean not null default false,
  has_immersive    boolean not null default false,
  created_at       timestamptz not null default now(),
  primary key (persona, key)
);

-- ─── Bibliothèque par utilisateur (ex session.json) ─────────────────────────────
create table if not exists public.library (
  user_id    uuid not null references auth.users(id) on delete cascade,
  persona    text not null,
  key        text not null,
  titre      text,
  artiste    text,
  artist_id  text,
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- ─── Progression des quêtes par utilisateur (ex progress.json) ──────────────────
create table if not exists public.progress (
  user_id   uuid not null references auth.users(id) on delete cascade,
  artist_id text not null,
  scans     int  not null default 0,
  primary key (user_id, artist_id)
);

-- ─── Garde-fou coût/abus : compteur de scans quotidien par utilisateur ──────────
create table if not exists public.usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null,
  scans   int  not null default 0,
  primary key (user_id, day)
);

-- ─── Row Level Security ─────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.artworks enable row level security;
alter table public.library  enable row level security;
alter table public.progress enable row level security;
alter table public.usage    enable row level security;

-- profiles : chacun ne voit/modifie que sa ligne
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- artworks : cache partagé, lecture pour tout authentifié ; écritures via service_role seulement
create policy "artworks_select_authenticated" on public.artworks
  for select to authenticated using (true);

-- library : chacun ne voit/modifie que ses lignes
create policy "library_select_own" on public.library
  for select to authenticated using (user_id = auth.uid());
create policy "library_insert_own" on public.library
  for insert to authenticated with check (user_id = auth.uid());
create policy "library_update_own" on public.library
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "library_delete_own" on public.library
  for delete to authenticated using (user_id = auth.uid());

-- progress : chacun ne voit/modifie que ses lignes
create policy "progress_select_own" on public.progress
  for select to authenticated using (user_id = auth.uid());
create policy "progress_insert_own" on public.progress
  for insert to authenticated with check (user_id = auth.uid());
create policy "progress_update_own" on public.progress
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- usage : lecture de sa propre conso ; écritures via service_role seulement
create policy "usage_select_own" on public.usage
  for select to authenticated using (user_id = auth.uid());

-- ─── Storage : bucket public pour les assets (photos / audio / immersive) ───────
-- Lecture publique servie par le CDN ; écritures via service_role (le backend).
insert into storage.buckets (id, name, public)
values ('artwork-assets', 'artwork-assets', true)
on conflict (id) do update set public = true;
