"use client";

import { useMemo, useState } from "react";
import ItemPicker from "@/components/ItemPicker";
import { createClient } from "@/lib/supabase/client";
import type { Base, Item } from "@/lib/types";

type Mode = "addons" | "swaps";

/**
 * Edit several bases at once:
 *  - add (or remove) add-ons to every selected base
 *  - add swap options for one ingredient in every selected base that uses it
 */
export default function BulkPanel({
  bases,
  items,
  onDone,
  onClear,
}: {
  bases: Base[]; // the selected bases
  items: Item[];
  onDone: (message: string) => Promise<void>;
  onClear: () => void;
}) {
  const [mode, setMode] = useState<Mode>("addons");
  const [picked, setPicked] = useState<string[]>([]);
  const [ingredient, setIngredient] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  // ingredients used by the selected bases, with how many bases use each
  const ingredients = useMemo(() => {
    const count = new Map<string, number>();
    bases.forEach((b) => new Set(b.base_items.map((c) => c.item_id)).forEach((id) => count.set(id, (count.get(id) ?? 0) + 1)));
    return [...count.entries()]
      .map(([id, n]) => ({ item: byId.get(id), n }))
      .filter((x): x is { item: Item; n: number } => !!x.item)
      .sort((a, b) => b.n - a.n || a.item.name.localeCompare(b.item.name));
  }, [bases, byId]);

  const ingredientItem = byId.get(ingredient);
  const basesWithIngredient = bases.filter((b) => b.base_items.some((c) => c.item_id === ingredient));

  const toggle = (it: Item) =>
    setPicked((p) => (p.includes(it.id) ? p.filter((x) => x !== it.id) : [...p, it.id]));

  const n = bases.length;
  const plural = (k: number, w: string) => `${k} ${w}${k === 1 ? "" : "s"}`;

  async function addAddons() {
    setBusy(true);
    setMsg(null);
    const rows = bases.flatMap((b) => {
      const have = new Set(b.addons.map((a) => a.item_id));
      let pos = b.addons.reduce((m, a) => Math.max(m, a.position), -1) + 1;
      return picked.filter((id) => !have.has(id)).map((item_id) => ({ base_id: b.id, item_id, position: pos++ }));
    });
    if (rows.length) {
      const { error } = await createClient()
        .from("swapcal_base_addons")
        .upsert(rows, { onConflict: "base_id,item_id", ignoreDuplicates: true });
      if (error) return fail(error.message);
    }
    finish(rows.length ? `Added ${plural(picked.length, "item")} to ${plural(n, "base")}.` : "Those were already on every selected base.");
  }

  async function removeAddons() {
    if (!confirm(`Remove ${plural(picked.length, "add-on")} from ${plural(n, "base")}?`)) return;
    setBusy(true);
    setMsg(null);
    const { error } = await createClient()
      .from("swapcal_base_addons")
      .delete()
      .in("base_id", bases.map((b) => b.id))
      .in("item_id", picked);
    if (error) return fail(error.message);
    finish(`Removed ${plural(picked.length, "add-on")} from ${plural(n, "base")}.`);
  }

  async function addSwaps() {
    setBusy(true);
    setMsg(null);
    const rows = basesWithIngredient.flatMap((b) => {
      const mine = b.swaps.filter((w) => w.item_id === ingredient);
      const have = new Set(mine.map((w) => w.swap_id));
      let pos = mine.reduce((m, w) => Math.max(m, w.position), -1) + 1;
      return picked
        .filter((id) => id !== ingredient && !have.has(id))
        .map((swap_id) => ({ base_id: b.id, item_id: ingredient, swap_id, position: pos++ }));
    });
    if (rows.length) {
      const { error } = await createClient()
        .from("swapcal_base_swaps")
        .upsert(rows, { onConflict: "base_id,item_id,swap_id", ignoreDuplicates: true });
      if (error) return fail(error.message);
    }
    finish(
      rows.length
        ? `${ingredientItem?.name} can now be swapped for ${plural(picked.length, "option")} in ${plural(basesWithIngredient.length, "base")}.`
        : "Those swap options were already set.",
    );
  }

  function fail(m: string) {
    setBusy(false);
    setMsg(m);
  }
  async function finish(m: string) {
    setBusy(false);
    setPicked([]);
    await onDone(m);
  }

  return (
    <div className="card space-y-4 border-accent p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="mr-auto font-display text-xl">Edit {plural(n, "base")} at once</h3>
        <button className="text-sm text-muted hover:text-ink" onClick={onClear}>Clear selection</button>
      </div>
      <p className="text-xs text-muted">{bases.map((b) => b.name).join(" · ")}</p>

      <div className="flex rounded-lg border border-line p-0.5 text-xs">
        {([
          ["addons", "Add-ons"],
          ["swaps", "Swap options"],
        ] as const).map(([m, l]) => (
          <button key={m} onClick={() => { setMode(m); setPicked([]); }}
            className={`flex-1 rounded-md px-2 py-1.5 ${mode === m ? "bg-ink text-bg" : "text-muted"}`}>
            {l}
          </button>
        ))}
      </div>

      {mode === "swaps" && (
        <label className="block">
          <span className="label">Ingredient to give swap options</span>
          <select className="input mt-1 w-full" value={ingredient} onChange={(e) => { setIngredient(e.target.value); setPicked([]); }}>
            <option value="">Choose an ingredient…</option>
            {ingredients.map(({ item, n: k }) => (
              <option key={item.id} value={item.id}>
                {item.name} — in {k} of {n}
              </option>
            ))}
          </select>
        </label>
      )}

      {(mode === "addons" || ingredient) && (
        <>
          <p className="text-sm">
            {mode === "addons"
              ? "Tick everything to add (or remove) — mix-ins, toppings, sauces, an extra scoop of protein…"
              : `Tick what ${ingredientItem?.name ?? "it"} can be swapped for.`}
          </p>
          <ItemPicker
            key={mode + ingredient}
            items={items}
            baseFirst={mode === "swaps"}
            defaultKind={mode === "swaps" && ingredientItem ? ingredientItem.kind : "all"}
            exclude={mode === "swaps" ? [ingredient] : []}
            selectedIds={picked}
            onPick={toggle}
          />
        </>
      )}

      <div className="flex flex-wrap gap-2">
        {mode === "addons" ? (
          <>
            <button className="btn-primary" disabled={busy || !picked.length} onClick={addAddons}>
              Add {picked.length || ""} to {plural(n, "base")}
            </button>
            <button className="btn" disabled={busy || !picked.length} onClick={removeAddons}>
              Remove from {plural(n, "base")}
            </button>
          </>
        ) : (
          <button className="btn-primary" disabled={busy || !picked.length || !ingredient} onClick={addSwaps}>
            Add {picked.length || ""} swap option{picked.length === 1 ? "" : "s"}
            {ingredient ? ` in ${plural(basesWithIngredient.length, "base")}` : ""}
          </button>
        )}
      </div>
      {msg && <p className="text-sm text-bad">{msg}</p>}
    </div>
  );
}
