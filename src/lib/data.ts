"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "./supabase/client";
import { normalizeKind, type Base, type Item } from "./types";

export function useLibrary() {
  const [items, setItems] = useState<Item[]>([]);
  const [bases, setBases] = useState<Base[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const sb = createClient();
    const [i, b] = await Promise.all([
      sb
        .from("swapcal_items")
        .select("*, components:swapcal_item_components!swapcal_item_components_item_id_fkey(*)")
        .order("name"),
      sb
        .from("swapcal_bases")
        .select("*, base_items:swapcal_base_items(*), addons:swapcal_base_addons(*), swaps:swapcal_base_swaps(*)")
        .order("category")
        .order("name"),
    ]);
    if (i.error || b.error) setError((i.error ?? b.error)!.message);
    else {
      const num = (x: Item): Item => ({
        ...x,
        kind: normalizeKind(x.kind),
        serving_size: Number(x.serving_size),
        calories: Number(x.calories),
        protein: Number(x.protein),
        carbs: Number(x.carbs),
        fat: Number(x.fat),
        fiber: Number(x.fiber ?? 0),
        recipe_yield: x.recipe_yield == null ? null : Number(x.recipe_yield),
        components: (x.components ?? []).map((c) => ({ ...c, amount: Number(c.amount) })),
      });
      setItems((i.data as Item[]).map(num));
      setBases(
        (b.data as Base[]).map((x) => ({
          ...x,
          category: x.category ?? "Other",
          servings: Number(x.servings),
          base_items: (x.base_items ?? []).map((c) => ({ ...c, amount: Number(c.amount) })),
          addons: x.addons ?? [],
          swaps: x.swaps ?? [],
        })),
      );
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { items, bases, loading, error, reload };
}

/** All categories in use, with the defaults first. */
export function allKinds(items: Item[]): string[] {
  const set = new Set<string>(["protein", "mixin", "sauce", "ingredient"]);
  items.forEach((i) => set.add(i.kind));
  return [...set];
}
