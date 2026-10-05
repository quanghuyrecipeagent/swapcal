-- SwapCal schema
-- Designed to live in the SAME Supabase project as GRAMS (nutriai-tracker),
-- so both apps share one login and SwapCal can log straight into food_entries.
-- Tables are prefixed swapcal_ so they never collide with GRAMS's tables.
--
-- Only two things are ever saved: library items and base recipes.
-- Calculator combinations are never stored.


-- ---------------------------------------------------------------------------
-- Library items. Macros are per `serving_size` `serving_unit`.
--   ingredient – general base ingredients (milk, pudding mix, sweeteners…)
--   protein    – protein powders, one row per brand/flavor
--   mixin      – stirred in (pretzels, chips, cookies…)
--   topping    – on top (syrup, whipped topping, fruit…)
-- ---------------------------------------------------------------------------
create table if not exists public.swapcal_items (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name          text not null,
  kind          text not null default 'ingredient'
                check (kind in ('ingredient', 'protein', 'mixin', 'topping')),
  serving_size  numeric not null default 1 check (serving_size > 0),
  serving_unit  text not null default 'g',
  calories      numeric not null default 0 check (calories >= 0),
  protein       numeric not null default 0 check (protein >= 0),
  carbs         numeric not null default 0 check (carbs >= 0),
  fat           numeric not null default 0 check (fat >= 0),
  fiber         numeric not null default 0 check (fiber >= 0),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists swapcal_items_user_idx on public.swapcal_items (user_id, kind, name);

-- ---------------------------------------------------------------------------
-- Base recipes and what goes into them.
-- ---------------------------------------------------------------------------
create table if not exists public.swapcal_bases (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  servings    numeric not null default 1 check (servings > 0),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.swapcal_base_items (
  id          uuid primary key default gen_random_uuid(),
  base_id     uuid not null references public.swapcal_bases (id) on delete cascade,
  item_id     uuid not null references public.swapcal_items (id) on delete restrict,
  amount      numeric not null check (amount > 0), -- in the item's serving_unit
  position    int not null default 0
);

create index if not exists swapcal_base_items_base_idx on public.swapcal_base_items (base_id, position);

create or replace function public.swapcal_touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists swapcal_items_touch on public.swapcal_items;
create trigger swapcal_items_touch before update on public.swapcal_items
  for each row execute function public.swapcal_touch_updated_at();

drop trigger if exists swapcal_bases_touch on public.swapcal_bases;
create trigger swapcal_bases_touch before update on public.swapcal_bases
  for each row execute function public.swapcal_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security: every user sees only their own library.
-- ---------------------------------------------------------------------------
alter table public.swapcal_items      enable row level security;
alter table public.swapcal_bases      enable row level security;
alter table public.swapcal_base_items enable row level security;

drop policy if exists "swapcal own items" on public.swapcal_items;
create policy "swapcal own items" on public.swapcal_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "swapcal own bases" on public.swapcal_bases;
create policy "swapcal own bases" on public.swapcal_bases
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "swapcal own base items" on public.swapcal_base_items;
create policy "swapcal own base items" on public.swapcal_base_items
  for all
  using (exists (select 1 from public.swapcal_bases b where b.id = base_id and b.user_id = auth.uid()))
  with check (
    exists (select 1 from public.swapcal_bases b where b.id = base_id and b.user_id = auth.uid())
    and exists (select 1 from public.swapcal_items i where i.id = item_id and i.user_id = auth.uid())
  );

-- GRAMS's food_entries table already exists in this project; SwapCal only
-- inserts into it (one row per "Log to GRAMS"). Nothing here changes it.
