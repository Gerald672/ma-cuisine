-- ============================================================
-- Ma Cave — tables Supabase (à exécuter une fois : SQL Editor > New query > Run)
-- Chaque table a RLS + policies (chacun ne voit que ses vins)
-- ============================================================

create table if not exists public.wines (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nom           text not null,
  producteur    text,
  millesime     text,
  couleur       text not null default 'rouge' check (couleur in ('rouge','blanc','rose','bulles','doux')),
  region        text,
  pays          text,
  cepages       text,
  casier        text,
  quantite      integer not null default 0 check (quantite >= 0),
  garde         text,
  prix          text,
  note          numeric,
  commentaire   text,
  barcode       text,
  vivino_url    text,
  vivino_note   numeric,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists wines_user_idx    on public.wines (user_id);
create index if not exists wines_barcode_idx on public.wines (user_id, barcode);

create table if not exists public.wine_movements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  wine_id     uuid not null references public.wines(id) on delete cascade,
  delta       integer not null,
  libelle     text,
  created_at  timestamptz not null default now()
);
create index if not exists wine_mvt_wine_idx on public.wine_movements (wine_id);
create index if not exists wine_mvt_user_idx on public.wine_movements (user_id);

alter table public.wines          enable row level security;
alter table public.wine_movements enable row level security;

drop policy if exists "wines_select" on public.wines;
drop policy if exists "wines_insert" on public.wines;
drop policy if exists "wines_update" on public.wines;
drop policy if exists "wines_delete" on public.wines;
create policy "wines_select" on public.wines for select to authenticated using (user_id = (select auth.uid()));
create policy "wines_insert" on public.wines for insert to authenticated with check (user_id = (select auth.uid()));
create policy "wines_update" on public.wines for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "wines_delete" on public.wines for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "wine_mvt_select" on public.wine_movements;
drop policy if exists "wine_mvt_insert" on public.wine_movements;
drop policy if exists "wine_mvt_delete" on public.wine_movements;
create policy "wine_mvt_select" on public.wine_movements for select to authenticated using (user_id = (select auth.uid()));
create policy "wine_mvt_insert" on public.wine_movements for insert to authenticated
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.wines w where w.id = wine_id and w.user_id = (select auth.uid())));
create policy "wine_mvt_delete" on public.wine_movements for delete to authenticated using (user_id = (select auth.uid()));
