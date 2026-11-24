-- ============================================================
-- Collections de recettes (Noël, anniversaire...) — à exécuter une fois
-- Supabase > SQL Editor > New query > Run
-- RLS + policies : chacun ne voit que ses collections
-- ============================================================

create table if not exists public.recipe_collections (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nom            text not null,
  emoji          text not null default '🎄',
  date_evenement date,
  convives       integer,
  notes          text,
  created_at     timestamptz not null default now()
);
create index if not exists recipe_collections_user_idx on public.recipe_collections (user_id);

create table if not exists public.recipe_collection_items (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  collection_id  uuid not null references public.recipe_collections(id) on delete cascade,
  recipe_id      uuid not null references public.recipes(id) on delete cascade,
  section        text not null default 'Plat',
  position       integer not null default 0,
  created_at     timestamptz not null default now(),
  unique (collection_id, recipe_id)
);
create index if not exists rci_user_idx on public.recipe_collection_items (user_id);
create index if not exists rci_recipe_idx on public.recipe_collection_items (recipe_id);

alter table public.recipe_collections      enable row level security;
alter table public.recipe_collection_items enable row level security;

drop policy if exists "rcol_select" on public.recipe_collections;
drop policy if exists "rcol_insert" on public.recipe_collections;
drop policy if exists "rcol_update" on public.recipe_collections;
drop policy if exists "rcol_delete" on public.recipe_collections;
create policy "rcol_select" on public.recipe_collections for select to authenticated using (user_id = (select auth.uid()));
create policy "rcol_insert" on public.recipe_collections for insert to authenticated with check (user_id = (select auth.uid()));
create policy "rcol_update" on public.recipe_collections for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "rcol_delete" on public.recipe_collections for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "rci_select" on public.recipe_collection_items;
drop policy if exists "rci_insert" on public.recipe_collection_items;
drop policy if exists "rci_update" on public.recipe_collection_items;
drop policy if exists "rci_delete" on public.recipe_collection_items;
create policy "rci_select" on public.recipe_collection_items for select to authenticated using (user_id = (select auth.uid()));
create policy "rci_insert" on public.recipe_collection_items for insert to authenticated
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.recipe_collections c where c.id = collection_id and c.user_id = (select auth.uid())));
create policy "rci_update" on public.recipe_collection_items for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "rci_delete" on public.recipe_collection_items for delete to authenticated using (user_id = (select auth.uid()));
