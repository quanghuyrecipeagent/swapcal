-- SwapCal 0002 — run after 0001 (safe to run whether or not you've used the app yet).
--
-- 1. Bases get a `category` you name yourself (Ice cream, Yogurt, Cream of rice,
--    Oatmeal, …) so the base library can hold any kind of recipe.
-- 2. Each base gets its own add-on list (swapcal_base_addons): the mix-ins,
--    toppings, sauces… that go with THAT base, shown first in the calculator.
-- 3. Item categories are no longer fixed. "ingredient" and "protein" keep their
--    special meaning (base ingredients); anything else — mixin, topping, sauce,
--    drizzle, crunch… — is treated as an add-on category you create.
-- 4. Items can be built from other items (a homemade sauce): the recipe is kept
--    in swapcal_item_components so you can re-open and edit it; the item's own
--    per-serving macros are recalculated when you save.

-- 1 ---------------------------------------------------------------------------
alter table public.swapcal_bases
  add column if not exists category text not null default 'Other';

create index if not exists swapcal_bases_user_cat_idx on public.swapcal_bases (user_id, category, name);

-- 2 ---------------------------------------------------------------------------
create table if not exists public.swapcal_base_addons (
  base_id   uuid not null references public.swapcal_bases (id) on delete cascade,
  item_id   uuid not null references public.swapcal_items (id) on delete cascade,
  position  int not null default 0,
  primary key (base_id, item_id)
);

alter table public.swapcal_base_addons enable row level security;

drop policy if exists "swapcal own base addons" on public.swapcal_base_addons;
create policy "swapcal own base addons" on public.swapcal_base_addons
  for all
  using (exists (select 1 from public.swapcal_bases b where b.id = base_id and b.user_id = auth.uid()))
  with check (
    exists (select 1 from public.swapcal_bases b where b.id = base_id and b.user_id = auth.uid())
    and exists (select 1 from public.swapcal_items i where i.id = item_id and i.user_id = auth.uid())
  );

-- 3 ---------------------------------------------------------------------------
alter table public.swapcal_items drop constraint if exists swapcal_items_kind_check;
alter table public.swapcal_items
  add constraint swapcal_items_kind_check check (length(trim(kind)) between 1 and 40);

-- 4 ---------------------------------------------------------------------------
create table if not exists public.swapcal_item_components (
  id            uuid primary key default gen_random_uuid(),
  item_id       uuid not null references public.swapcal_items (id) on delete cascade,
  component_id  uuid not null references public.swapcal_items (id) on delete restrict,
  amount        numeric not null check (amount > 0),
  position      int not null default 0,
  check (item_id <> component_id)
);

create index if not exists swapcal_item_components_item_idx on public.swapcal_item_components (item_id, position);

alter table public.swapcal_item_components enable row level security;

drop policy if exists "swapcal own item components" on public.swapcal_item_components;
create policy "swapcal own item components" on public.swapcal_item_components
  for all
  using (exists (select 1 from public.swapcal_items i where i.id = item_id and i.user_id = auth.uid()))
  with check (
    exists (select 1 from public.swapcal_items i where i.id = item_id and i.user_id = auth.uid())
    and exists (select 1 from public.swapcal_items c where c.id = component_id and c.user_id = auth.uid())
  );

-- A built item remembers the total yield of its recipe so per-serving macros
-- can be recalculated (e.g. sauce recipe makes 240 g, serving = 30 g).
alter table public.swapcal_items
  add column if not exists recipe_yield numeric check (recipe_yield is null or recipe_yield > 0);
