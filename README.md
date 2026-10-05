# SwapCal

A recipe **calculator**, not a recipe log. Pick a base (e.g. protein ice cream), add mix-ins and toppings, swap or remove ingredients, and see calories and macros update live. Copy the result as text or send it to GRAMS as a one-off log entry.

**What gets saved:** only your library — ingredients, mix-ins, toppings — and your base recipes.
**What never gets saved:** the combinations you build in the calculator. "Ice cream + pretzels" and "ice cream + chocolate chips" are never stored as separate meals.

Stack: Next.js 15 (App Router) on Vercel · Supabase (Postgres + RLS) · Tailwind 4.
SwapCal lives in **the same Supabase project as GRAMS** (nutriai-tracker), so you sign in with your GRAMS email and password and "Log to GRAMS" writes straight into your GRAMS diary.

---

## Setup

### 1. Supabase (GRAMS's existing project)
1. Open the GRAMS project (`zadiqpsrtkuxjsvyyncb`) → SQL editor.
2. Paste and run `supabase/migrations/0001_init.sql`. It only creates new `swapcal_*` tables; it doesn't touch any GRAMS table.
3. Run `supabase/migrations/0002_groups_addons_categories.sql` the same way (safe to re-run).
4. Optional starter library: put your GRAMS email into `supabase/seed_example.sql` and run it. It adds four bases (ice cream, yogurt bowl, cream of rice, oatmeal), each with its own add-ons, four protein powders, and a homemade PB2 sauce. The macros are typical label values; check them against what you buy.

### 2. Local
```bash
cp .env.example .env.local   # anon key: same value as SUPABASE_ANON in GRAMS's index.html
npm install
npm run dev
npm test                     # calculator math tests
```

### 3. Vercel
Import the repo as a new Vercel project, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, deploy.

---

## The library

### Bases
A base is any recipe you build on: ice cream, a yogurt bowl, cream of rice, oatmeal, pancakes… Each base has:
- a **category** you name yourself (bases are grouped by it in the library and in the calculator's base picker),
- its **ingredients** with batch amounts and a "makes N servings" number,
- its own **add-ons**: the mix-ins, toppings and sauces that go with it. The calculator opens on that list, with a toggle to the whole library.

**Duplicate** a base to make a variation (chocolate vs vanilla ice cream) without re-entering everything.

### Ingredients & add-ons
Every item has nutrition per serving (calories, protein, carbs, fat, fiber) and a category:

| Category | Notes |
|---|---|
| **Protein** | Protein powders, one entry per brand/flavor. Swapping the protein in a base shows only proteins. |
| **Ingredient** | Everything else that goes into bases. |
| **Mix-in, Topping, Sauce** | Built-in add-on categories. |
| **Your own** | Tap **+ New category** (Drizzle, Crunch, Fruit…). |

Three ways to add items:
1. **Enter macros** from the label.
2. **Build from ingredients**: for homemade things like PB2 sauce. Pick what goes in, say how much the whole recipe makes and what one serving is, and SwapCal calculates the per-serving macros. The recipe is kept so you can edit it later (re-save if an ingredient's macros change).
3. **Paste many**: copy rows from a spreadsheet or type CSV, one item per line:
   `name, category, serving, unit, cal, protein, carbs, fat, fiber`
   A header row in any order works too (`Name, Cal, P, C, F, Serving`…), and `28g` in the serving column is understood. Bad lines are listed and skipped.

From inside a base editor, **New item / New add-on** opens the same form and attaches the result to that base.

## How the calculator works

- Pick a base, change amounts, **Swap** an ingredient (default amount = same number of servings, and the list opens on the same category), **Remove** one, add the base's add-ons **on my portion** or **in the whole batch**, and set how many servings you're eating.
- Nothing in the calculator is saved.

---

## GRAMS integration

**Log to GRAMS** inserts one row into GRAMS's `food_entries`, in the same shape GRAMS's own `saveEntry()` uses:

| column | value |
|---|---|
| `name` | e.g. `Protein ice cream + Mini pretzels (w/ Dymatize ISO100 – Gourmet Vanilla)` |
| `description` | `SwapCal · 1 of 2 servings · 360 ml Fairlife skim milk, 31 g …` |
| `calories`, `protein`, `carbs`, `fat`, `fiber` | your portion, rounded to whole numbers like GRAMS |
| `micros` | `{}` |
| `eaten_date` / `eaten_at` | today (local date) / now |

It never writes to `saved_foods`, so your GRAMS library doesn't fill up with near-duplicate meals. The entry appears in GRAMS the next time it loads (refresh GRAMS if it's already open). Delete or edit it in GRAMS like any other entry.

**Copy recipe** puts a plain-text summary on your clipboard as well.

---

## Project map
```
supabase/migrations/0001_init.sql   swapcal_items, swapcal_bases, swapcal_base_items + RLS
supabase/migrations/0002_*.sql      base categories, per-base add-ons, custom item categories, built items
supabase/seed_example.sql           optional starter library
src/lib/calc.ts                     all calculator math + export formats (tested)
src/app/page.tsx                    calculator
src/app/library/page.tsx            library shell
src/components/library/             BasesTab (base editor + add-ons), ItemsTab, ItemForm, paste import
src/lib/importer.ts                 paste/CSV parser (tested)
src/middleware.ts                   auth gate (redirects to /login)
```
