"use client";

import { useMemo, useState } from "react";
import ItemForm, { blankDraft, draftFromItem, type ItemDraft } from "./ItemForm";
import { createClient } from "@/lib/supabase/client";
import { round } from "@/lib/calc";
import { allKinds } from "@/lib/data";
import { parseImport } from "@/lib/importer";
import { kindLabel, kindPlural, type Item } from "@/lib/types";

export default function ItemsTab({ items, reload }: { items: Item[]; reload: () => Promise<void> }) {
  const [draft, setDraft] = useState<ItemDraft>(blankDraft());
  const [formKey, setFormKey] = useState(0);
  const [panel, setPanel] = useState<"form" | "import">("form");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [msg, setMsg] = useState<string | null>(null);

  const kinds = useMemo(() => allKinds(items).filter((k) => items.some((i) => i.kind === k)), [items]);
  const usedIn = useMemo(() => {
    const m = new Map<string, string[]>();
    items.forEach((i) => i.components?.forEach((c) => m.set(c.component_id, [...(m.get(c.component_id) ?? []), i.name])));
    return m;
  }, [items]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((i) => (filter === "all" || i.kind === filter) && (!s || i.name.toLowerCase().includes(s)));
  }, [items, q, filter]);

  const edit = (d: ItemDraft) => {
    setDraft(d);
    setFormKey((k) => k + 1);
    setPanel("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  async function remove(item: Item) {
    if (!confirm(`Delete "${item.name}"?`)) return;
    const { error } = await createClient().from("swapcal_items").delete().eq("id", item.id);
    if (error)
      setMsg(
        error.code === "23503"
          ? `"${item.name}" is used in a base or a built item. Remove it there first.`
          : error.message,
      );
    else {
      setMsg(null);
      await reload();
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <div className="card self-start p-5 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto">
        <div className="mb-4 flex rounded-lg border border-line p-0.5 text-xs">
          {([["form", draft.id ? "Edit item" : "Add one"], ["import", "Paste many"]] as const).map(([p, l]) => (
            <button key={p} type="button" onClick={() => setPanel(p)}
              className={`flex-1 rounded-md px-2 py-1.5 ${panel === p ? "bg-ink text-bg" : "text-muted"}`}>
              {l}
            </button>
          ))}
        </div>
        {panel === "form" ? (
          <ItemForm
            key={formKey}
            items={items}
            initial={draft}
            onCancel={draft.id ? () => edit(blankDraft(draft.kind)) : undefined}
            onSaved={async () => {
              await reload();
              edit(blankDraft(draft.kind));
            }}
          />
        ) : (
          <ImportPanel kinds={allKinds(items)} onDone={reload} />
        )}
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <input className="input min-w-0 flex-1" placeholder={`Search ${items.length} items…`} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-1">
          {["all", ...kinds].map((k) => (
            <button key={k} onClick={() => setFilter(k)}
              className={`chip ${filter === k ? "border-accent text-accent" : ""}`}>
              {k === "all" ? `All · ${items.length}` : `${kindPlural(k)} · ${items.filter((i) => i.kind === k).length}`}
            </button>
          ))}
        </div>
        {msg && <p className="text-sm text-bad">{msg}</p>}
        {kinds
          .filter((k) => filter === "all" || filter === k)
          .map((k) => {
            const list = shown.filter((i) => i.kind === k);
            if (!list.length) return null;
            return (
              <section key={k}>
                <h3 className="label mb-2">{kindPlural(k)}</h3>
                <ul className="card divide-y divide-line">
                  {list.map((i) => (
                    <li key={i.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="truncate">
                          {i.name}
                          {!!i.components?.length && <span className="chip ml-2 align-middle">homemade</span>}
                        </div>
                        <div className="tabular truncate text-xs text-muted">
                          per {round(i.serving_size, 1)} {i.serving_unit} · P {round(i.protein, 1)} · C {round(i.carbs, 1)} · F {round(i.fat, 1)} · Fib {round(i.fiber, 1)}
                          {usedIn.get(i.id) && <> · in {usedIn.get(i.id)!.join(", ")}</>}
                        </div>
                      </div>
                      <span className="tabular shrink-0 text-sm font-semibold">{round(i.calories)} cal</span>
                      <button className="text-sm text-muted hover:text-ink" onClick={() => edit(draftFromItem(i))}>Edit</button>
                      <button className="text-sm text-muted hover:text-bad" onClick={() => remove(i)}>Delete</button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        {items.length > 0 && shown.length === 0 && <p className="text-sm text-muted">Nothing matches.</p>}
        {items.length === 0 && (
          <p className="text-sm text-muted">Your library is empty. Add items one at a time, or paste a list from a spreadsheet.</p>
        )}
      </div>
    </div>
  );
}

function ImportPanel({ kinds, onDone }: { kinds: string[]; onDone: () => Promise<void> }) {
  const [text, setText] = useState("");
  const [fallback, setFallback] = useState("ingredient");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const parsed = useMemo(() => parseImport(text, fallback), [text, fallback]);

  async function save() {
    if (!parsed.rows.length) return;
    setBusy(true);
    const { error } = await createClient().from("swapcal_items").insert(parsed.rows);
    setBusy(false);
    if (error) return setMsg(error.message);
    setMsg(`Added ${parsed.rows.length} item${parsed.rows.length === 1 ? "" : "s"}.`);
    setText("");
    await onDone();
  }

  return (
    <div className="space-y-3">
      <h2 className="font-display text-xl">Paste many items</h2>
      <p className="text-sm text-muted">
        One item per line, copied from a spreadsheet or typed as CSV. Columns in this order (a header row in any order also works):
      </p>
      <code className="block rounded-lg bg-bg p-2 text-xs leading-relaxed">
        name, category, serving, unit, cal, protein, carbs, fat, fiber
      </code>
      <textarea
        className="input h-40 w-full font-mono text-xs"
        placeholder={"Mini pretzels, mixin, 28, g, 110, 3, 23, 1, 1\nPB2, sauce, 13, g, 60, 6, 5, 1.5, 2\nHoney, drizzle, 21, g, 64, 0, 17, 0, 0"}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted">If a line has no category:</span>
        <select className="input py-1 text-sm" value={fallback} onChange={(e) => setFallback(e.target.value)}>
          {kinds.map((k) => <option key={k} value={k}>{kindLabel(k)}</option>)}
        </select>
      </label>
      {text.trim() && (
        <div className="rounded-lg border border-line p-2 text-xs">
          <div className="mb-1 font-semibold">
            {parsed.rows.length} ready{parsed.errors.length ? ` · ${parsed.errors.length} skipped` : ""}
          </div>
          <ul className="max-h-32 space-y-0.5 overflow-y-auto">
            {parsed.rows.map((r, i) => (
              <li key={i} className="tabular flex gap-2">
                <span className="min-w-0 flex-1 truncate">{r.name}</span>
                <span className="text-muted">{kindLabel(r.kind)}</span>
                <span>{r.calories} cal/{r.serving_size}{r.serving_unit}</span>
              </li>
            ))}
            {parsed.errors.map((e, i) => <li key={`e${i}`} className="text-bad">{e}</li>)}
          </ul>
        </div>
      )}
      <button disabled={busy || !parsed.rows.length} onClick={save} className="btn-primary w-full">
        {busy ? "Adding…" : `Add ${parsed.rows.length || ""} to library`}
      </button>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
