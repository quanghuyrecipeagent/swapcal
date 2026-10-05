import type { Base, Item, Macros } from "./types";

export const ZERO: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

export function add(a: Macros, b: Macros): Macros {
  return {
    calories: a.calories + b.calories,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
    fiber: a.fiber + b.fiber,
  };
}

export function sub(a: Macros, b: Macros): Macros {
  return add(a, scaleMacros(b, -1));
}

export function scaleMacros(m: Macros, f: number): Macros {
  return {
    calories: m.calories * f,
    protein: m.protein * f,
    carbs: m.carbs * f,
    fat: m.fat * f,
    fiber: m.fiber * f,
  };
}

/** Macros for `amount` of an item, where amount is in the item's serving_unit. */
export function macrosFor(item: Item, amount: number): Macros {
  if (!item.serving_size || !isFinite(amount) || amount <= 0) return ZERO;
  return scaleMacros(item, amount / item.serving_size);
}

/**
 * Amount of `to` that matches the same number of servings as `amount` of `from`.
 * Used as the default when swapping one ingredient for another.
 */
export function equivalentAmount(from: Item, amount: number, to: Item): number {
  // same unit (g → g, ml → ml): keep the amount — 40 g flour becomes 40 g oat flour
  if (from.serving_unit.trim().toLowerCase() === to.serving_unit.trim().toLowerCase()) return amount;
  // different units: match the number of servings
  const servings = amount / from.serving_size;
  return round(servings * to.serving_size, 1);
}

// ---------------------------------------------------------------------------
// Calculator state — lives only in the browser, never saved.
// ---------------------------------------------------------------------------

export interface ComponentEdit {
  removed?: boolean;
  /** Override amount (in the unit of whichever item is in use). */
  amount?: number;
  /** Swap this component for a different library item. */
  swapToId?: string;
}

export interface Extra {
  key: string;
  itemId: string;
  amount: number;
}

export interface CalcState {
  baseId: string | null;
  edits: Record<string, ComponentEdit>; // keyed by base_items.id
  extras: Extra[];
  /** How many of the base's servings you're eating/logging. */
  portion: number;
  /** Extras are added to the whole batch, or to the portion only. */
  extrasScope: "batch" | "portion";
}

export interface Line {
  key: string;
  label: string;
  item: Item;
  amount: number;
  macros: Macros;
  status: "base" | "changed" | "swapped" | "removed" | "added";
  original?: { item: Item; amount: number; macros: Macros };
}

export interface CalcResult {
  base: Base;
  lines: Line[];
  original: Macros; // base as written, whole batch
  batch: Macros; // modified, whole batch (excludes portion-scoped extras)
  portion: Macros; // what you're actually eating / logging
  originalPortion: Macros;
  delta: Macros; // portion - originalPortion
  title: string;
}

export function compute(
  state: CalcState,
  bases: Base[],
  items: Item[],
): CalcResult | null {
  const base = bases.find((b) => b.id === state.baseId);
  if (!base) return null;
  const byId = new Map(items.map((i) => [i.id, i]));

  const lines: Line[] = [];
  let original = ZERO;
  let batch = ZERO;
  const removedNames: string[] = [];
  const swapNames: string[] = [];

  const components = [...base.base_items].sort((a, b) => a.position - b.position);
  for (const c of components) {
    const origItem = byId.get(c.item_id);
    if (!origItem) continue;
    const origMacros = macrosFor(origItem, c.amount);
    original = add(original, origMacros);

    const e = state.edits[c.id] ?? {};
    const orig = { item: origItem, amount: c.amount, macros: origMacros };

    if (e.removed) {
      removedNames.push(origItem.name);
      lines.push({
        key: c.id,
        label: origItem.name,
        item: origItem,
        amount: 0,
        macros: ZERO,
        status: "removed",
        original: orig,
      });
      continue;
    }

    const swapped = e.swapToId ? byId.get(e.swapToId) : undefined;
    const item = swapped ?? origItem;
    const amount =
      e.amount ?? (swapped ? equivalentAmount(origItem, c.amount, swapped) : c.amount);
    const m = macrosFor(item, amount);
    batch = add(batch, m);

    let status: Line["status"] = "base";
    if (swapped && swapped.id !== origItem.id) {
      status = "swapped";
      swapNames.push(swapped.name);
    } else if (amount !== c.amount) status = "changed";

    lines.push({ key: c.id, label: item.name, item, amount, macros: m, status, original: orig });
  }

  const portionFactor = state.portion / base.servings;
  let extrasMacros = ZERO;
  const addedNames: string[] = [];
  for (const x of state.extras) {
    const item = byId.get(x.itemId);
    if (!item) continue;
    const m = macrosFor(item, x.amount);
    extrasMacros = add(extrasMacros, m);
    addedNames.push(item.name);
    lines.push({ key: x.key, label: item.name, item, amount: x.amount, macros: m, status: "added" });
  }

  let portion: Macros;
  if (state.extrasScope === "batch") {
    batch = add(batch, extrasMacros);
    portion = scaleMacros(batch, portionFactor);
  } else {
    portion = add(scaleMacros(batch, portionFactor), extrasMacros);
  }

  const originalPortion = scaleMacros(original, portionFactor);

  const parts: string[] = [base.name];
  if (addedNames.length) parts.push(`+ ${[...new Set(addedNames)].join(", ")}`);
  if (swapNames.length) parts.push(`(w/ ${swapNames.join(", ")})`);
  if (removedNames.length) parts.push(`(no ${removedNames.join(", ")})`);

  return {
    base,
    lines,
    original,
    batch,
    portion,
    originalPortion,
    delta: sub(portion, originalPortion),
    title: parts.join(" "),
  };
}

// ---------------------------------------------------------------------------
// Formatting / export
// ---------------------------------------------------------------------------

export function round(n: number, dp = 0): number {
  const f = 10 ** dp;
  return Math.round((n + Number.EPSILON) * f) / f;
}

export function roundMacros(m: Macros): Macros {
  return {
    calories: round(m.calories),
    protein: round(m.protein, 1),
    carbs: round(m.carbs, 1),
    fat: round(m.fat, 1),
    fiber: round(m.fiber, 1),
  };
}

export function fmtAmount(n: number): string {
  return String(round(n, 1));
}

export function toPlainText(r: CalcResult, state: CalcState): string {
  const p = roundMacros(r.portion);
  const lines = [
    r.title,
    `Portion: ${fmtAmount(state.portion)} of ${fmtAmount(r.base.servings)} serving${r.base.servings === 1 ? "" : "s"}`,
    `${p.calories} cal · ${p.protein}g protein · ${p.carbs}g carbs · ${p.fat}g fat · ${p.fiber}g fiber`,
    "",
    "Ingredients (whole batch):",
  ];
  for (const l of r.lines) {
    if (l.status === "removed") continue;
    const tag = l.status === "added" ? (state.extrasScope === "portion" ? " (on portion)" : " (added)") : "";
    lines.push(`- ${fmtAmount(l.amount)} ${l.item.serving_unit} ${l.label}${tag}`);
  }
  return lines.join("\n");
}

/**
 * A row for GRAMS's `food_entries` table (nutriai-tracker). Matches the shape
 * GRAMS's own saveEntry() writes: whole-number macros, local calendar date.
 * Only food_entries is written — never saved_foods — so nothing piles up in
 * the GRAMS library.
 */
export interface GramsFoodEntry {
  user_id: string;
  name: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  micros: Record<string, number>;
  eaten_date: string; // YYYY-MM-DD, local
  eaten_at: string; // ISO timestamp
}

export function localDate(d: Date): string {
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const dy = String(d.getDate()).padStart(2, "0");
  return `${yr}-${mo}-${dy}`;
}

export function toGramsEntry(
  r: CalcResult,
  state: CalcState,
  userId: string,
  now: Date = new Date(),
): GramsFoodEntry {
  const p = r.portion;
  const portionLabel =
    state.portion === r.base.servings
      ? "whole batch"
      : `${fmtAmount(state.portion)} of ${fmtAmount(r.base.servings)} servings`;
  const ingredients = r.lines
    .filter((l) => l.status !== "removed")
    .map((l) => `${fmtAmount(l.amount)} ${l.item.serving_unit} ${l.label}`)
    .join(", ");
  return {
    user_id: userId,
    name: r.title,
    description: `SwapCal · ${portionLabel} · ${ingredients}`,
    calories: Math.round(p.calories),
    protein: Math.round(p.protein),
    carbs: Math.round(p.carbs),
    fat: Math.round(p.fat),
    fiber: Math.round(p.fiber),
    micros: {},
    eaten_date: localDate(now),
    eaten_at: now.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Built items (homemade sauce, topping…): macros come from a recipe.
// ---------------------------------------------------------------------------

/**
 * Per-serving macros for an item built from other items.
 * `recipeYield` is how much the whole recipe makes, in the built item's unit
 * (e.g. 240 g of sauce); one serving is `servingSize` of that.
 */
export function builtItemMacros(
  components: { component_id: string; amount: number }[],
  items: Item[],
  recipeYield: number,
  servingSize: number,
): { total: Macros; perServing: Macros } {
  const byId = new Map(items.map((i) => [i.id, i]));
  const total = components.reduce((acc, c) => {
    const it = byId.get(c.component_id);
    return it ? add(acc, macrosFor(it, c.amount)) : acc;
  }, ZERO);
  const perServing =
    recipeYield > 0 && servingSize > 0 ? scaleMacros(total, servingSize / recipeYield) : ZERO;
  return { total, perServing };
}

// ---------------------------------------------------------------------------
// Over-goal levels (used to tint numbers red, darker the further over).
// ---------------------------------------------------------------------------

/** 0 = within goal, 1 = up to 10% over, 2 = up to 25% over, 3 = more. */
export type OverTier = 0 | 1 | 2 | 3;

export function overTier(total: number, goal: number | null | undefined): OverTier {
  if (!goal || goal <= 0) return 0;
  const over = Math.round(total) - goal;
  if (over <= 0) return 0;
  const r = over / goal;
  return r <= 0.1 ? 1 : r <= 0.25 ? 2 : 3;
}
