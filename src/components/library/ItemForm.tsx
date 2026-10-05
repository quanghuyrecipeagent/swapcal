"use client";

import { useMemo, useState } from "react";
import ItemPicker from "@/components/ItemPicker";
import { createClient } from "@/lib/supabase/client";
import { builtItemMacros, macrosFor, round, roundMacros } from "@/lib/calc";
import { allKinds } from "@/lib/data";
import { kindLabel, normalizeKind, type Item } from "@/lib/types";

type Mode = "label" | "built";

export interface ItemDraft {
  id?: string;
  name: string;
  kind: string;
  serving_size: number;
  serving_unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  recipe_yield: number;
  components: { key: string; component_id: string; amount: number }[];
}

export function draftFromItem(i: Item): ItemDraft {
  return {
    id: i.id,
    name: i.name,
    kind: i.kind,
    serving_size: i.serving_size,
    serving_unit: i.serving_unit,
    calories: i.calories,
    protein: i.protein,
    carbs: i.carbs,
    fat: i.fat,
    fiber: i.fiber,
    recipe_yield: i.recipe_yield ?? 0,
    components: (i.components ?? [])
      .sort((a, b) => a.position - b.position)
      .map((c) => ({ key: c.id, component_id: c.component_id, amount: c.amount })),
  };
}

export const blankDraft = (kind = "mixin"): ItemDraft => ({
  name: "", kind, serving_size: 1, serving_unit: "g",
  calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0,
  recipe_yield: 0, components: [],
});

const UNITS = ["g", "ml", "oz", "cup", "tbsp", "tsp", "piece", "scoop", "serving"];

export default function ItemForm({
  items,
  initial,
  onSaved,
  onCancel,
  title,
}: {
  items: Item[];
  initial: ItemDraft;
  onSaved: (id: string) => void | Promise<void>;
  onCancel?: () => void;
  title?: string;
}) {
  const [d, setD] = useState<ItemDraft>(initial);
  const [mode, setMode] = useState<Mode>(initial.components.length ? "built" : "label");
  const [newKind, setNewKind] = useState("");
  const [addingKind, setAddingKind] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const kinds = useMemo(() => {
    const k = allKinds(items);
    if (d.kind && !k.includes(d.kind)) k.push(d.kind);
    return k;
  }, [items, d.kind]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  // can't build an item out of itself
  const componentChoices = useMemo(() => items.filter((i) => i.id !== d.id), [items, d.id]);

  const built = useMemo(
    () => builtItemMacros(d.components, items, d.recipe_yield, d.serving_size),
    [d.components, d.recipe_yield, d.serving_size, items],
  );
  const shown =
    mode === "built"
      ? { ...roundMacros(built.perServing), calories: round(built.perServing.calories, built.perServing.calories < 10 ? 1 : 0) }
      : null;

  const set = <K extends keyof ItemDraft>(k: K, v: ItemDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const numInput = (k: "serving_size" | "calories" | "protein" | "carbs" | "fat" | "fiber" | "recipe_yield") =>
    (e: React.ChangeEvent<HTMLInputElement>) => set(k, e.target.value === "" ? 0 : Number(e.target.value));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!d.name.trim()) return setMsg("Give it a name.");
    if (mode === "built") {
      if (!d.components.length) return setMsg("Add at least one ingredient to the recipe.");
      if (!(d.recipe_yield > 0)) return setMsg("Enter how much the recipe makes.");
    }
    setBusy(true);
    const sb = createClient();
    const macros = mode === "built" ? built.perServing : d;
    const row = {
      name: d.name.trim(),
      kind: d.kind,
      serving_size: d.serving_size,
      serving_unit: d.serving_unit.trim() || "g",
      calories: round(macros.calories, 2),
      protein: round(macros.protein, 2),
      carbs: round(macros.carbs, 2),
      fat: round(macros.fat, 2),
      fiber: round(macros.fiber, 2),
      recipe_yield: mode === "built" ? d.recipe_yield : null,
    };
    let id = d.id;
    if (id) {
      const { error } = await sb.from("swapcal_items").update(row).eq("id", id);
      if (error) return fail(error.message);
    } else {
      const { data, error } = await sb.from("swapcal_items").insert(row).select("id").single();
      if (error) return fail(error.message);
      id = data.id as string;
    }
    // replace the recipe (empty for label-entered items)
    const del = await sb.from("swapcal_item_components").delete().eq("item_id", id);
    if (del.error) return fail(del.error.message);
    if (mode === "built") {
      const { error } = await sb.from("swapcal_item_components").insert(
        d.components.map((c, i) => ({ item_id: id, component_id: c.component_id, amount: c.amount, position: i })),
      );
      if (error) return fail(error.message);
    }
    setBusy(false);
    await onSaved(id!);

    function fail(m: string) {
      setBusy(false);
      setMsg(m);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="mr-auto font-display text-xl">{title ?? (d.id ? "Edit item" : "New item")}</h2>
        {onCancel && (
          <button type="button" className="text-sm text-muted hover:text-ink" onClick={onCancel}>Cancel</button>
        )}
      </div>

      <input
        required
        className="input w-full"
        placeholder={
          d.kind === "protein" ? "Brand – flavor (e.g. ON Whey – Vanilla)"
          : d.kind === "sauce" ? "e.g. PB2 sauce"
          : "Name (e.g. Mini pretzels)"
        }
        value={d.name}
        onChange={(e) => set("name", e.target.value)}
      />

      {/* Category */}
      <div>
        <span className="label">Category</span>
        <div className="mt-1 flex flex-wrap gap-1">
          {kinds.map((k) => (
            <button
              type="button"
              key={k}
              onClick={() => set("kind", k)}
              className={`chip py-1 ${d.kind === k ? "border-accent text-accent" : ""}`}
            >
              {kindLabel(k)}
            </button>
          ))}
          {addingKind ? (
            <span className="flex gap-1">
              <input
                autoFocus
                className="input w-28 px-2 py-0.5 text-xs"
                placeholder="e.g. Drizzle"
                value={newKind}
                onChange={(e) => setNewKind(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (newKind.trim()) set("kind", normalizeKind(newKind));
                    setAddingKind(false);
                    setNewKind("");
                  }
                }}
              />
              <button
                type="button"
                className="chip py-1"
                onClick={() => {
                  if (newKind.trim()) set("kind", normalizeKind(newKind));
                  setAddingKind(false);
                  setNewKind("");
                }}
              >
                Add
              </button>
            </span>
          ) : (
            <button type="button" className="chip border-dashed py-1" onClick={() => setAddingKind(true)}>
              + New category
            </button>
          )}
        </div>
      </div>

      {/* How macros are entered */}
      <div className="flex rounded-lg border border-line p-0.5 text-xs">
        {([
          ["label", "Enter macros"],
          ["built", "Build from ingredients"],
        ] as const).map(([m, l]) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-md px-2 py-1.5 ${mode === m ? "bg-ink text-bg" : "text-muted"}`}
          >
            {l}
          </button>
        ))}
      </div>

      {mode === "built" && (
        <div className="space-y-3 rounded-xl border border-line p-3">
          <span className="label">Recipe</span>
          {d.components.length === 0 && (
            <p className="text-sm text-muted">Pick what goes into it — e.g. PB2 + water + sweetener.</p>
          )}
          <ul className="divide-y divide-line">
            {d.components.map((c) => {
              const it = byId.get(c.component_id);
              if (!it) return null;
              return (
                <li key={c.key} className="flex items-center gap-2 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-sm">{it.name}</span>
                  <input
                    type="number" min={0} step="any"
                    className="input tabular w-20 px-2 py-1 text-right"
                    value={c.amount}
                    onChange={(e) =>
                      set("components", d.components.map((x) => (x.key === c.key ? { ...x, amount: Number(e.target.value) || 0 } : x)))
                    }
                  />
                  <span className="w-9 text-xs text-muted">{it.serving_unit}</span>
                  <span className="tabular w-12 text-right text-xs text-muted">{round(macrosFor(it, c.amount).calories)}</span>
                  <button type="button" className="text-muted hover:text-bad" aria-label="Remove"
                    onClick={() => set("components", d.components.filter((x) => x.key !== c.key))}>×</button>
                </li>
              );
            })}
          </ul>
          <ItemPicker
            compact
            baseFirst
            items={componentChoices}
            onPick={(it) =>
              set("components", [...d.components, { key: crypto.randomUUID(), component_id: it.id, amount: it.serving_size }])
            }
          />
          <label className="block">
            <span className="label">Whole recipe makes</span>
            <div className="mt-1 flex items-center gap-2">
              <input type="number" min={0} step="any" className="input tabular w-24" value={d.recipe_yield || ""}
                placeholder="240" onChange={numInput("recipe_yield")} />
              <span className="text-sm text-muted">{d.serving_unit || "g"} total</span>
              <span className="tabular ml-auto text-xs text-muted">{round(built.total.calories)} cal in the batch</span>
            </div>
          </label>
        </div>
      )}

      <div>
        <span className="label">{mode === "built" ? "One serving is" : "Nutrition per serving of"}</span>
        <div className="mt-1 flex gap-2">
          <input type="number" step="any" min={0.01} required className="input tabular w-24" value={d.serving_size} onChange={numInput("serving_size")} />
          <input className="input w-24" list="units" value={d.serving_unit} onChange={(e) => set("serving_unit", e.target.value)} />
          <datalist id="units">{UNITS.map((u) => <option key={u} value={u} />)}</datalist>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {(["calories", "protein", "carbs", "fat", "fiber"] as const).map((k) => (
          <label key={k}>
            <span className="label">{k === "calories" ? "Cal" : k === "protein" ? "Prot" : k}</span>
            {shown ? (
              <div className="tabular mt-1 rounded-lg border border-dashed border-line px-2 py-2 text-sm">{shown[k]}</div>
            ) : (
              <input type="number" step="any" min={0} className="input tabular mt-1 w-full px-2" value={d[k]} onChange={numInput(k)} />
            )}
          </label>
        ))}
      </div>
      {mode === "built" && <p className="text-xs text-muted">Calculated from the recipe. If you change an ingredient later, re-save this item to update it.</p>}

      <button disabled={busy} className="btn-primary w-full">{busy ? "Saving…" : d.id ? "Save changes" : "Add to library"}</button>
      {msg && <p className="text-sm text-bad">{msg}</p>}
    </form>
  );
}
