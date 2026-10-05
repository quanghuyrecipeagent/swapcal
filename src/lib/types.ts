/**
 * Item categories are free text the user can create ("sauce", "crunch"…).
 * Two are special: "ingredient" and "protein" are base ingredients; every
 * other category is treated as an add-on.
 */
export type ItemKind = string;

export const BASE_KINDS = ["ingredient", "protein"] as const;
export const DEFAULT_KINDS = ["protein", "mixin", "topping", "sauce", "ingredient"] as const;

export function isBaseKind(kind: string): boolean {
  return (BASE_KINDS as readonly string[]).includes(kind);
}

const LABELS: Record<string, string> = {
  ingredient: "Ingredient",
  protein: "Protein",
  mixin: "Mix-in",
  topping: "Topping",
  sauce: "Sauce",
};

export function kindLabel(kind: string): string {
  return LABELS[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1);
}

export function kindPlural(kind: string): string {
  const l = kindLabel(kind);
  return /[sxz]$|ch$|sh$/i.test(l) ? l + "es" : l + "s";
}

/** Normalise what the user typed into a category key. */
export function normalizeKind(raw: string): string {
  const k = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (k === "mix-in" || k === "mix in" || k === "mixins" || k === "mix-ins") return "mixin";
  if (k.endsWith("s") && LABELS[k.slice(0, -1)]) return k.slice(0, -1);
  return k;
}

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface ItemComponent {
  id: string;
  item_id: string;
  component_id: string;
  amount: number;
  position: number;
}

export interface Item extends Macros {
  id: string;
  name: string;
  kind: ItemKind;
  serving_size: number;
  serving_unit: string;
  notes: string | null;
  recipe_yield?: number | null;
  components?: ItemComponent[];
}

export interface BaseItem {
  id: string;
  base_id: string;
  item_id: string;
  amount: number;
  position: number;
}

export interface BaseAddon {
  base_id: string;
  item_id: string;
  position: number;
}

export interface Base {
  id: string;
  name: string;
  category: string;
  servings: number;
  notes: string | null;
  base_items: BaseItem[];
  addons: BaseAddon[];
}
