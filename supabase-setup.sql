-- =============================================
-- Script SQL pour Supabase — Ma cuisine
-- Colle ce script dans : Supabase > SQL Editor
-- =============================================

-- Table des recettes
create table public.recipes (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null,
  source      text,
  url         text,
  emoji       text default '🍳',
  time        integer default 30,
  cost        numeric(6,2) default 0,
  cats        text[] default '{}',
  ingredients jsonb default '[]',
  steps       jsonb default '[]',
  notes       text,
  created_at  timestamptz default now()
);

-- Table du stock d'ingrédients
create table public.stock (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users(id) on delete cascade not null,
  name       text not null,
  qty        numeric(10,2) default 0,
  unit       text default 'g',
  cat        text default 'Épicerie',
  seuil      numeric(10,2) default 0,
  updated_at timestamptz default now()
);

-- Sécurité : chaque utilisateur ne voit que ses propres données (RLS)
alter table public.recipes enable row level security;
alter table public.stock   enable row level security;

-- Politiques pour les recettes
create policy "recipes: lecture propre" on public.recipes
  for select using (auth.uid() = user_id);

create policy "recipes: insertion propre" on public.recipes
  for insert with check (auth.uid() = user_id);

create policy "recipes: modification propre" on public.recipes
  for update using (auth.uid() = user_id);

create policy "recipes: suppression propre" on public.recipes
  for delete using (auth.uid() = user_id);

-- Politiques pour le stock
create policy "stock: lecture propre" on public.stock
  for select using (auth.uid() = user_id);

create policy "stock: insertion propre" on public.stock
  for insert with check (auth.uid() = user_id);

create policy "stock: modification propre" on public.stock
  for update using (auth.uid() = user_id);

create policy "stock: suppression propre" on public.stock
  for delete using (auth.uid() = user_id);

-- Index pour les performances
create index recipes_user_id_idx on public.recipes(user_id);
create index stock_user_id_idx   on public.stock(user_id);
