-- ============================================================
-- Dégustations (vins bus au restaurant, chez des amis...) — à exécuter une fois
-- Supabase > SQL Editor > New query > Run
-- RLS + policies : chacun ne voit que ses dégustations
-- ============================================================

create table if not exists public.wine_tastings (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nom              text not null,
  producteur       text,
  millesime        text,
  couleur          text not null default 'rouge' check (couleur in ('rouge','blanc','rose','bulles','doux')),
  region           text,
  pays             text,
  cepages          text,
  lieu             text,
  date_degustation date not null default current_date,
  prix             text,
  note             numeric,
  commentaire      text,
  created_at       timestamptz not null default now()
);
create index if not exists wine_tastings_user_idx on public.wine_tastings (user_id, date_degustation desc);

alter table public.wine_tastings enable row level security;

drop policy if exists "wine_tastings_select" on public.wine_tastings;
drop policy if exists "wine_tastings_insert" on public.wine_tastings;
drop policy if exists "wine_tastings_update" on public.wine_tastings;
drop policy if exists "wine_tastings_delete" on public.wine_tastings;
create policy "wine_tastings_select" on public.wine_tastings for select to authenticated using (user_id = (select auth.uid()));
create policy "wine_tastings_insert" on public.wine_tastings for insert to authenticated with check (user_id = (select auth.uid()));
create policy "wine_tastings_update" on public.wine_tastings for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "wine_tastings_delete" on public.wine_tastings for delete to authenticated using (user_id = (select auth.uid()));
