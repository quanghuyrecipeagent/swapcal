"use client";

import { useEffect, useMemo, useState } from "react";
import ItemPicker from "@/components/ItemPicker";
import ItemForm, { blankDraft } from "./ItemForm";
import { createClient } from "@/lib/supabase/client";
import { add, macrosFor, round, roundMacros, scaleMacros, ZERO } from "@/lib/calc";
import { kindLabel, type Base, type Item } from "@/lib/types";

const SUGGESTED_CATEGORIES = ["Ice cream", "Yogurt bowl", "Cream of rice", "Oatmeal", "Smoothie", "Pancakes"];

type BaseDraft = {
  id?: string;
  name: string;
  category: string;
  servings: number;
  notes: string;
  components: { key: string; item_id: string; amount: number }[];
  addons: string[]; // item ids, in order
};

const blankBase = (category = ""): BaseDraft => ({
  name: "", category, servings: 1, notes: "", components: [], addons: [],
});

function toDraft(b: Base): BaseDraft {
  return {
    id: b.id,
    name: b.name,
    category: b.category,
    servings: b.servings,
    notes: b.notes ?? "",
    components: [...b.base_items]
      .sort((x, y) => x.position - y.position)
      .map((c) => ({ key: c.id, item_id: c.item_id, amount: c.amount })),
    addons: [...b.addons].sort((x, y) => x.position - y.position).map((a) => a.item_id),
  };
}

export default function BasesTab({
  items,
  bases,
  reload,
}: {
  items: Item[];
  bases: Base[];
  reload: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<BaseDraft | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const categories = useMemo(() => {
    const set = new Set(bases.map((b) => b.category));
    return [...set].sort();
  }, [bases]);

  const totalFor = (comps: { item_id: string; amount: number }[]) =>
    comps.reduce((acc, c) => {
      const it = byId.get(c.item_id);
      return it ? add(acc, macrosFor(it, c.amount)) : acc;
    }, ZERO);

  async function remove(b: Base) {
    if (!confirm(`Delete base "${b.name}"? Its add-on list goes with it; the items stay in your library.`)) return;
    const { error } = await createClient().from("swapcal_bases").delete().eq("id", b.id);
    if (error) setMsg(error.message);
    else await reload();
  }

  if (draft)
    return (
      <BaseEditor
        key={draft.id ?? "new"}
        initial={draft}
        items={items}
        categories={[...new Set([...categories, ...SUGGESTED_CATEGORIES])]}
        reload={reload}
        onClose={() => setDraft(null)}
      />
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary" onClick={() => setDraft(blankBase())}>New base</button>
        <span className="text-sm text-muted">
          A base is any recipe you build on — ice cream, yogurt, cream of rice, oatmeal… Each one keeps its own add-ons.
        </span>
      </div>
      {msg && <p className="text-sm text-bad">{msg}</p>}
      {bases.length === 0 && (
        <div className="card p-6 text-sm text-muted">
          No bases yet. Start with one you make often, add its ingredients, then pick the mix-ins and toppings that go with it.
        </div>
      )}
      {categories.map((cat) => (
        <section key={cat}>
          <div className="mb-2 flex items-center gap-2">
            <h3 className="font-display text-xl">{cat}</h3>
            <button className="text-xs text-muted hover:text-accent" onClick={() => setDraft(blankBase(cat))}>+ add {cat.toLowerCase()}</button>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {bases
              .filter((b) => b.category === cat)
              .map((b) => {
                const tot = totalFor(b.base_items);
                return (
                  <li key={b.id} className="card p-4">
                    <div className="flex items-start gap-3">
                      <h4 className="mr-auto text-lg font-medium leading-snug">{b.name}</h4>
                      <button className="text-sm text-muted hover:text-ink" onClick={() => setDraft(toDraft(b))}>Edit</button>
                      <button
                        className="text-sm text-muted hover:text-ink"
                        onClick={() => setDraft({ ...toDraft(b), id: undefined, name: `${b.name} (copy)` })}
                      >
                        Duplicate
                      </button>
                      <button className="text-sm text-muted hover:text-bad" onClick={() => remove(b)}>Delete</button>
                    </div>
                    <p className="tabular mt-1 text-sm text-muted">
                      {round(tot.calories / b.servings)} cal / serving · makes {round(b.servings, 2)}
                    </p>
                    <p className="mt-2 text-xs text-muted">
                      {b.base_items.length} ingredients · {b.addons.length} add-ons
                      {b.addons.length > 0 && (
                        <>
                          {": "}
                          {b.addons
                            .slice(0, 4)
                            .map((a) => byId.get(a.item_id)?.name)
                            .filter(Boolean)
                            .join(", ")}
                          {b.addons.length > 4 && "…"}
                        </>
                      )}
                    </p>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

function BaseEditor({
  initial,
  items,
  categories,
  reload,
  onClose,
}: {
  initial: BaseDraft;
  items: Item[];
  categories: string[];
  reload: () => Promise<void>;
  onClose: () => void;
}) {
  const [d, setD] = useState<BaseDraft>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [picker, setPicker] = useState<"ingredients" | "addons" | null>(initial.components.length ? null : "ingredients");
  const [creating, setCreating] = useState<"ingredients" | "addons" | null>(null);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const [pendingIngredient, setPendingIngredient] = useState<string | null>(null);

  // An ingredient created from this editor joins the base once the library reloads with it.
  useEffect(() => {
    if (!pendingIngredient) return;
    const it = byId.get(pendingIngredient);
    if (!it) return;
    setD((x) => ({ ...x, components: [...x.components, { key: crypto.randomUUID(), item_id: it.id, amount: it.serving_size }] }));
    setPendingIngredient(null);
  }, [pendingIngredient, byId]);

  const total = d.components.reduce((acc, c) => {
    const it = byId.get(c.item_id);
    return it ? add(acc, macrosFor(it, c.amount)) : acc;
  }, ZERO);
  const t = roundMacros(total);
  const per = roundMacros(scaleMacros(total, 1 / (d.servings || 1)));

  const addComponent = (it: Item) =>
    setD((x) => ({ ...x, components: [...x.components, { key: crypto.randomUUID(), item_id: it.id, amount: it.serving_size }] }));
  const addAddon = (it: Item) =>
    setD((x) => (x.addons.includes(it.id) ? x : { ...x, addons: [...x.addons, it.id] }));

  async function save() {
    if (!d.name.trim()) return setMsg("Give the base a name.");
    if (!d.category.trim()) return setMsg("Pick or type a category (e.g. Oatmeal).");
    if (!d.components.length) return setMsg("Add at least one ingredient.");
    setBusy(true);
    setMsg(null);
    const sb = createClient();
    const row = {
      name: d.name.trim(),
      category: d.category.trim(),
      servings: d.servings || 1,
      notes: d.notes.trim() || null,
    };
    let id = d.id;
    if (id) {
      const { error } = await sb.from("swapcal_bases").update(row).eq("id", id);
      if (error) return fail(error.message);
      for (const table of ["swapcal_base_items", "swapcal_base_addons"]) {
        const del = await sb.from(table).delete().eq("base_id", id);
        if (del.error) return fail(del.error.message);
      }
    } else {
      const { data, error } = await sb.from("swapcal_bases").insert(row).select("id").single();
      if (error) return fail(error.message);
      id = data.id as string;
    }
    const ins = await sb
      .from("swapcal_base_items")
      .insert(d.components.map((c, i) => ({ base_id: id, item_id: c.item_id, amount: c.amount, position: i })));
    if (ins.error) return fail(ins.error.message);
    if (d.addons.length) {
      const a = await sb
        .from("swapcal_base_addons")
        .insert(d.addons.map((item_id, i) => ({ base_id: id, item_id, position: i })));
      if (a.error) return fail(a.error.message);
    }
    setBusy(false);
    await reload();
    onClose();

    function fail(m: string) {
      setBusy(false);
      setMsg(m);
    }
  }

  const addonItems = d.addons.map((id) => byId.get(id)).filter(Boolean) as Item[];

  return (
    <div className="space-y-5">
      <button className="text-sm text-muted hover:text-ink" onClick={onClose}>← All bases</button>

      <section className="card space-y-3 p-5">
        <div className="flex flex-wrap gap-3">
          <label className="min-w-0 basis-full sm:basis-auto sm:flex-1">
            <span className="label">Base name</span>
            <input className="input mt-1 w-full font-display text-lg" value={d.name} placeholder="e.g. Chocolate protein oats"
              onChange={(e) => setD({ ...d, name: e.target.value })} />
          </label>
          <label className="w-44">
            <span className="label">Category</span>
            <input className="input mt-1 w-full" list="base-cats" value={d.category} placeholder="Oatmeal"
              onChange={(e) => setD({ ...d, category: e.target.value })} />
            <datalist id="base-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </label>
          <label className="w-28">
            <span className="label">Makes (servings)</span>
            <input type="number" min={0.1} step="any" className="input tabular mt-1 w-full" value={d.servings}
              onChange={(e) => setD({ ...d, servings: Number(e.target.value) || 0 })} />
          </label>
        </div>
        <input className="input w-full text-sm" placeholder="Notes (optional) — e.g. Ninja Creami pint, re-spin twice" value={d.notes}
          onChange={(e) => setD({ ...d, notes: e.target.value })} />
      </section>

      {/* Ingredients */}
      <section className="card space-y-3 p-5">
        <div className="flex items-center gap-2">
          <h3 className="label mr-auto">Ingredients · whole batch</h3>
          <button className="btn px-2 py-1 text-xs" onClick={() => setPicker(picker === "ingredients" ? null : "ingredients")}>
            {picker === "ingredients" ? "Done" : "+ Add ingredient"}
          </button>
          <button className="btn px-2 py-1 text-xs" onClick={() => setCreating("ingredients")}>New item</button>
        </div>
        {d.components.length === 0 && <p className="text-sm text-muted">Nothing yet.</p>}
        <ul className="divide-y divide-line">
          {d.components.map((c) => {
            const it = byId.get(c.item_id);
            if (!it) return null;
            return (
              <li key={c.key} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1">
                  {it.name}
                  {it.kind !== "ingredient" && <span className="chip ml-2 align-middle">{kindLabel(it.kind)}</span>}
                </span>
                <input type="number" min={0} step="any" className="input tabular w-20 px-2 py-1 text-right" value={c.amount}
                  onChange={(e) => setD({ ...d, components: d.components.map((x) => (x.key === c.key ? { ...x, amount: Number(e.target.value) || 0 } : x)) })} />
                <span className="w-9 text-xs text-muted">{it.serving_unit}</span>
                <span className="tabular w-14 text-right text-sm">{round(macrosFor(it, c.amount).calories)}</span>
                <button className="text-muted hover:text-bad" aria-label="Remove"
                  onClick={() => setD({ ...d, components: d.components.filter((x) => x.key !== c.key) })}>×</button>
              </li>
            );
          })}
        </ul>
        {picker === "ingredients" && (
          <div className="rounded-xl border border-line p-3">
            <ItemPicker compact baseFirst items={items} onPick={addComponent} />
          </div>
        )}
        <div className="tabular flex flex-wrap gap-x-6 gap-y-1 border-t border-line pt-3 text-sm">
          <span><b>{t.calories}</b> cal batch</span>
          <span><b>{per.calories}</b> cal / serving</span>
          <span className="text-muted">P {per.protein} · C {per.carbs} · F {per.fat} · Fib {per.fiber} per serving</span>
        </div>
      </section>

      {/* Add-ons */}
      <section className="card space-y-3 p-5">
        <div className="flex items-center gap-2">
          <div className="mr-auto">
            <h3 className="label">Add-ons for this base</h3>
            <p className="text-xs text-muted">The mix-ins, toppings and sauces you use with this one. They show first in the calculator.</p>
          </div>
          <button className="btn px-2 py-1 text-xs" onClick={() => setPicker(picker === "addons" ? null : "addons")}>
            {picker === "addons" ? "Done" : "+ Add from library"}
          </button>
          <button className="btn px-2 py-1 text-xs" onClick={() => setCreating("addons")}>New add-on</button>
        </div>
        {addonItems.length === 0 ? (
          <p className="text-sm text-muted">None yet.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {addonItems.map((it) => (
              <li key={it.id} className="flex items-center gap-2 rounded-full border border-line bg-bg py-1 pl-3 pr-2 text-sm">
                <span>{it.name}</span>
                <span className="text-xs text-muted">{kindLabel(it.kind)}</span>
                <button className="text-muted hover:text-bad" aria-label={`Remove ${it.name}`}
                  onClick={() => setD({ ...d, addons: d.addons.filter((x) => x !== it.id) })}>×</button>
              </li>
            ))}
          </ul>
        )}
        {picker === "addons" && (
          <div className="rounded-xl border border-line p-3">
            <ItemPicker
              compact
              items={items}
              exclude={d.addons}
              onPick={addAddon}
            />
          </div>
        )}
      </section>

      <div className="flex gap-2">
        <button disabled={busy} onClick={save} className="btn-primary">{busy ? "Saving…" : d.id ? "Save base" : "Create base"}</button>
        <button onClick={onClose} className="btn">Cancel</button>
      </div>
      {msg && <p className="text-sm text-bad">{msg}</p>}

      {creating && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={() => setCreating(null)}>
          <div className="card max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-b-none p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <ItemForm
              items={items}
              initial={blankDraft(creating === "addons" ? "topping" : "ingredient")}
              title={creating === "addons" ? "New add-on" : "New ingredient"}
              onCancel={() => setCreating(null)}
              onSaved={async (id) => {
                const target = creating;
                await reload();
                setCreating(null);
                if (target === "addons") setD((x) => (x.addons.includes(id) ? x : { ...x, addons: [...x.addons, id] }));
                else setPendingIngredient(id);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
