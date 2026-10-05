-- Optional starter library. Run AFTER 0001 and 0002, in GRAMS's Supabase project.
-- Put the email you sign in to GRAMS with below.
-- Macros are typical label values and vary by brand/flavor — edit them in the
-- Library page to match what you actually buy.

do $$
declare
  uid uuid := (select id from auth.users where email = 'you@example.com');
  -- ingredients
  milk uuid; almond uuid; pudding uuid; sugar uuid; allulose uuid; water uuid;
  yogurt uuid; oats uuid; cor uuid; pb2 uuid;
  -- proteins
  on_whey uuid; iso uuid; ghost uuid; casein uuid;
  -- add-ons
  pretzels uuid; chips uuid; oreos uuid; pb uuid; syrup uuid; whip uuid;
  straw uuid; blue uuid; banana uuid; granola uuid; honey uuid; cinnamon uuid;
  pb2sauce uuid;
  b uuid;
begin
  if uid is null then
    raise exception 'Put the email you use for GRAMS in this script.';
  end if;


  insert into public.swapcal_items (user_id, name, kind, serving_size, serving_unit, calories, protein, carbs, fat, fiber) values
    (uid, 'Fairlife skim milk',        'ingredient', 240, 'ml',  80, 13,  6,   0,   0) returning id into milk;
  insert into public.swapcal_items (user_id, name, kind, serving_size, serving_unit, calories, protein, carbs, fat, fiber) values
    (uid, 'Unsweetened almond milk',   'ingredient', 240, 'ml',  30,  1,  1, 2.5,   0) returning id into almond;
  insert into public.swapcal_items (user_id, name, kind, serving_size, serving_unit, calories, protein, carbs, fat, fiber) values
    (uid, 'Sugar-free pudding mix',    'ingredient',   8, 'g',   25,  0,  6,   0,   0) returning id into pudding;
  insert into public.swapcal_items (user_id, name, kind, serving_size, serving_unit, calories, protein, carbs, fat, fiber) values
    (uid, 'Granulated sugar',          'ingredient',   4, 'g',   16,  0,  4,   0,   0) returning id into sugar;
  insert into public.swapcal_items (user_id, name, kind, serving_size, serving_unit, calories, protein, carbs, fat, fiber) values
    (uid, 'Allulose',                  'ingredient',   8, 'g',    0,  0,  8,   0,   0) returning id into allulose;
  insert into public.swapcal_items (user_id, name, kind, serving_size, serving_unit, calories, protein, carbs, fat, fiber) values
    (uid, 'Water',                     'ingredient', 240, 'ml',   0,  0,  0,   0,   0) returning id into water;
  insert into public.swapcal_items (user_id, name, kind, serving_size, serving_unit, calories, protein, carbs, fat, fiber) values
    (uid, 'Nonfat Greek yogurt',       'ingredient', 170, 'g',   90, 16,  6,   0,   0) returning id into yogurt;
  insert into public.swapcal_items (user_id, name, kind, serving_size, serving_unit, calories, protein, carbs, fat, fiber) values
    (uid, 'Rolled oats',               'ingredient',  40, 'g',  150,  5, 27,   3,   4) returning id into oats;
  insert into public.swapcal_items (user_id, name, kind, serving_size, serving_unit, calories, protein, carbs, fat, fiber) values
    (uid, 'Cream of rice (dry)',       'ingredient',  45, 'g',  170,  3, 38,   0,   0) returning id into cor;
  insert into public.swapcal_items (user_id, name, kind, serving_size, serving_unit, calories, protein, carbs, fat, fiber) values
    (uid, 'PB2 powder',                'ingredient',  13, 'g',   60,  6,  5, 1.5,   2) returning id into pb2;

  insert into public.swapcal_items (user_id, name, kind, serving_size, serving_unit, calories, protein, carbs, fat, fiber) values
    (uid, 'ON Gold Standard Whey – Vanilla',   'protein', 31, 'g', 120, 24, 4, 1.5, 0) returning id into on_whey;
  insert into public.swapcal_items (user_id, name, kind, serving_size, serving_unit, calories, protein, carbs, fat, fiber) values
    (uid, 'Dymatize ISO100 – Gourmet Vanilla', 'protein', 31, 'g', 110, 25, 2, 0.5, 0) returning id into iso;
  insert into public.swapcal_items (user_id, name, kind, serving_size, serving_unit, calories, protein, carbs, fat, fiber) values
    (uid, 'Ghost Whey – Cereal Milk',          'protein', 34, 'g', 130, 25, 4, 1.5, 0) returning id into ghost;
  insert into public.swapcal_items (user_id, name, kind, serving_size, serving_unit, calories, protein, carbs, fat, fiber) values
    (uid, 'Casein (generic) – Chocolate',      'protein', 34, 'g', 120, 24, 4, 1,   1) returning id into casein;

  insert into public.swapcal_items (user_id, name, kind, serving_size, serving_unit, calories, protein, carbs, fat, fiber) values
    (uid, 'Mini pretzels',              'mixin',   28, 'g',  110, 3, 23, 1,   1) returning id into pretzels;
  insert into public.swapcal_items (user_id, name, kind, serving_size, serving_unit, calories, protein, carbs, fat, fiber) values
    (uid, 'Semi-sweet chocolate chips', 'mixin',   15, 'g',   70, 1,  9, 4,   1) returning id into chips;
  insert into public.swapcal_items (user_id, name, kind, serving_size, serving_unit, calories, protein, carbs, fat, fiber) values
    (uid, 'Crushed Oreos',              'mixin',   34, 'g',  160, 1, 25, 7,   1) returning id into oreos;
  insert into public.swapcal_items (user_id, name, kind, serving_size, serving_unit, calories, protein, carbs, fat, fiber) values
    (uid, 'Peanut butter',              'mixin',   32, 'g',  190, 7,  8, 16,  2) returning id into pb;
  insert into public.swapcal_items (user_id, name, kind, serving_size, serving_unit, calories, protein, carbs, fat, fiber) values
    (uid, 'Sugar-free chocolate syrup', 'sauce',   30, 'ml',  15, 0,  4, 0,   0) returning id into syrup;
  insert into public.swapcal_items (user_id, name, kind, serving_size, serving_unit, calories, protein, carbs, fat, fiber) values
    (uid, 'Fat-free whipped topping',   'topping',  9, 'g',   15, 0,  3, 0,   0) returning id into whip;
  insert into public.swapcal_items (user_id, name, kind, serving_size, serving_unit, calories, protein, carbs, fat, fiber) values
    (uid, 'Strawberries',               'topping',100, 'g',   32, 1,  8, 0.3, 2) returning id into straw;
  insert into public.swapcal_items (user_id, name, kind, serving_size, serving_unit, calories, protein, carbs, fat, fiber) values
    (uid, 'Blueberries',                'topping', 74, 'g',   42, 0.5, 11, 0.2, 2) returning id into blue;
  insert into public.swapcal_items (user_id, name, kind, serving_size, serving_unit, calories, protein, carbs, fat, fiber) values
    (uid, 'Banana',                     'topping',118, 'g',  105, 1.3, 27, 0.4, 3) returning id into banana;
  insert into public.swapcal_items (user_id, name, kind, serving_size, serving_unit, calories, protein, carbs, fat, fiber) values
    (uid, 'Granola',                    'topping', 30, 'g',  130, 3, 20, 4.5, 2) returning id into granola;
  insert into public.swapcal_items (user_id, name, kind, serving_size, serving_unit, calories, protein, carbs, fat, fiber) values
    (uid, 'Honey',                      'drizzle', 21, 'g',   64, 0, 17, 0,   0) returning id into honey;
  insert into public.swapcal_items (user_id, name, kind, serving_size, serving_unit, calories, protein, carbs, fat, fiber) values
    (uid, 'Cinnamon',                   'topping',  2.6, 'g',  6, 0, 2, 0,  1.4) returning id into cinnamon;

  -- A homemade sauce built from ingredients: 4 svg PB2 + 120 ml water makes ~172 g;
  -- one serving is 43 g → 60 cal, 6 g protein.
  insert into public.swapcal_items (user_id, name, kind, serving_size, serving_unit, calories, protein, carbs, fat, fiber, recipe_yield) values
    (uid, 'PB2 sauce', 'sauce', 43, 'g', 60, 6, 5, 1.5, 2, 172) returning id into pb2sauce;
  insert into public.swapcal_item_components (item_id, component_id, amount, position) values
    (pb2sauce, pb2, 52, 0),
    (pb2sauce, water, 120, 1);

  -- Ice cream --------------------------------------------------------------
  insert into public.swapcal_bases (user_id, name, category, servings, notes)
    values (uid, 'Vanilla protein ice cream', 'Ice cream', 2, 'Ninja Creami pint') returning id into b;
  insert into public.swapcal_base_items (base_id, item_id, amount, position) values
    (b, milk, 360, 0), (b, on_whey, 31, 1), (b, pudding, 8, 2), (b, sugar, 8, 3);
  insert into public.swapcal_base_addons (base_id, item_id, position) values
    (b, pretzels, 0), (b, chips, 1), (b, oreos, 2), (b, pb2sauce, 3), (b, syrup, 4), (b, whip, 5), (b, straw, 6);

  -- Yogurt bowl ------------------------------------------------------------
  insert into public.swapcal_bases (user_id, name, category, servings)
    values (uid, 'Protein yogurt bowl', 'Yogurt bowl', 1) returning id into b;
  insert into public.swapcal_base_items (base_id, item_id, amount, position) values
    (b, yogurt, 200, 0), (b, iso, 15, 1);
  insert into public.swapcal_base_addons (base_id, item_id, position) values
    (b, granola, 0), (b, blue, 1), (b, straw, 2), (b, honey, 3), (b, pb2sauce, 4), (b, chips, 5);

  -- Cream of rice ----------------------------------------------------------
  insert into public.swapcal_bases (user_id, name, category, servings)
    values (uid, 'Protein cream of rice', 'Cream of rice', 1) returning id into b;
  insert into public.swapcal_base_items (base_id, item_id, amount, position) values
    (b, cor, 45, 0), (b, water, 240, 1), (b, on_whey, 31, 2);
  insert into public.swapcal_base_addons (base_id, item_id, position) values
    (b, banana, 0), (b, pb2sauce, 1), (b, pb, 2), (b, cinnamon, 3), (b, honey, 4), (b, blue, 5);

  -- Oatmeal ----------------------------------------------------------------
  insert into public.swapcal_bases (user_id, name, category, servings)
    values (uid, 'Protein oats', 'Oatmeal', 1) returning id into b;
  insert into public.swapcal_base_items (base_id, item_id, amount, position) values
    (b, oats, 40, 0), (b, almond, 240, 1), (b, casein, 34, 2);
  insert into public.swapcal_base_addons (base_id, item_id, position) values
    (b, banana, 0), (b, blue, 1), (b, pb, 2), (b, pb2sauce, 3), (b, cinnamon, 4), (b, chips, 5), (b, honey, 6);
end $$;
