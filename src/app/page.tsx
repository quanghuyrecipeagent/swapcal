"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Nav from "@/components/Nav";
import ItemPicker from "@/components/ItemPicker";
import MacroRow, { Delta } from "@/components/MacroRow";
import GramsToday, { projectedTiers } from "@/components/GramsToday";
import { useGramsToday } from "@/lib/grams";
import { useLibrary } from "@/lib/data";
import { createClient } from "@/lib/supabase/client";
import {
  compute,
  fmtAmount,
  round,
  roundMacros,
  toGramsEntry,
  ZERO,
  toPlainText,
  type CalcState,
  type Line,
} from "@/lib/calc";
import { kindLabel, type Item } from "@/lib/types";

const fresh = (baseId: string | null, servings = 1): CalcState => ({
  baseId,
  edits: {},
  extras: [],
  portion: servings,
  extrasScope: "portion",
});

export default function CalculatorPage() {
  const { items, bases, loading, error } = useLibrary();
  const [state, setState] = useState<CalcState>(fresh(null));
  const [swapFor, setSwapFor] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [logging, setLogging] = useState(false);
  const [logged, setLogged] = useState(false);
  const grams = useGramsToday();

  // any change after logging is a new meal again
  useEffect(() => setLogged(false), [state]);

  useEffect(() => {
    if (!state.baseId && bases.length) setState(fresh(bases[0].id, 1));
  }, [bases, state.baseId]);

  const result = useMemo(() => compute(state, bases, items), [state, bases, items]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const editComponent = (key: string, patch: CalcState["edits"][string] | null) =>
    setState((s) => {
      const edits = { ...s.edits };
      if (patch === null) delete edits[key];
      else edits[key] = { ...edits[key], ...patch };
      return { ...s, edits };
    });

  // adding something that's already there adds another serving instead of a second line
  const addExtra = (item: Item) =>
    setState((s) => {
      const existing = s.extras.find((x) => x.itemId === item.id);
      if (existing)
        return {
          ...s,
          extras: s.extras.map((x) => (x.key === existing.key ? { ...x, amount: x.amount + item.serving_size } : x)),
        };
      return { ...s, extras: [...s.extras, { key: crypto.randomUUID(), itemId: item.id, amount: item.serving_size }] };
    });

  const setExtraAmount = (key: string, amount: number) =>
    setState((s) => ({ ...s, extras: s.extras.map((x) => (x.key === key ? { ...x, amount } : x)) }));

  const removeExtra = (key: string) =>
    setState((s) => ({ ...s, extras: s.extras.filter((x) => x.key !== key) }));

  async function copy() {
    if (!result) return;
    await navigator.clipboard.writeText(toPlainText(result, state));
    flash("Copied to clipboard");
  }

  // Writes one row to GRAMS's food_entries (same Supabase project, same login).
  async function sendToGrams() {
    if (!result || logging) return;
    setLogging(true);
    const sb = createClient();
    const { data } = await sb.auth.getUser();
    if (!data.user) {
      setLogging(false);
      return flash("Sign in again to log");
    }
    const { error } = await sb.from("food_entries").insert(toGramsEntry(result, state, data.user.id));
    setLogging(false);
    if (error) return flash(`Couldn't log: ${error.message}`);
    flash("Logged to today in GRAMS");
    await grams.refresh();
    setLogged(true);
  }

  // allowed swaps for an ingredient in the current base; the original is offered back once swapped
  function swapOptionsFor(originalId: string, currentId: string): string[] {
    const base = bases.find((b) => b.id === state.baseId);
    const ids = (base?.swaps ?? [])
      .filter((w) => w.item_id === originalId)
      .sort((a, b) => a.position - b.position)
      .map((w) => w.swap_id);
    return [...(currentId !== originalId ? [originalId] : []), ...ids].filter((id) => id !== currentId);
  }

  if (loading) return <Shell><p className="text-muted">Loading your library…</p></Shell>;
  if (error) return <Shell><p className="text-bad">{error}</p></Shell>;
  if (!bases.length)
    return (
      <Shell>
        <div className="card p-8 text-center">
          <h2 className="font-display text-2xl">No base recipes yet</h2>
          <p className="mt-2 text-muted">
            Add the ingredients and mix-ins you use, then build a base like your ice cream.
          </p>
          <Link href="/library" className="btn-primary mt-6">Open the library</Link>
        </div>
      </Shell>
    );

  const componentLines = result?.lines.filter((l) => l.status !== "added") ?? [];
  const extraLines = result?.lines.filter((l) => l.status === "added") ?? [];
  const p = result ? roundMacros(result.portion) : null;
  const meal = result && !logged ? result.portion : ZERO;
  const tiers = projectedTiers(grams.eaten, meal, grams.goals);
  const calTier = tiers.calories;
  const heroStyle = calTier ? { background: `var(--over-bg-${calTier})`, color: "#fff" } : undefined;
  const calOver = grams.goals ? Math.round(grams.eaten.calories + meal.calories - grams.goals.calories) : 0;

  return (
    <Shell>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          {/* Base + portion */}
          <section className="card p-4 sm:p-5">
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-0 basis-full sm:basis-auto sm:flex-1">
                <span className="label">Base</span>
                <select
                  className="input mt-1 w-full font-display text-lg"
                  value={state.baseId ?? ""}
                  onChange={(e) => setState(fresh(e.target.value, 1))}
                >
                  {[...new Set(bases.map((b) => b.category))].map((cat) => (
                    <optgroup key={cat} label={cat}>
                      {bases
                        .filter((b) => b.category === cat)
                        .map((b) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label className="w-36">
                <span className="label">Eating</span>
                <div className="mt-1 flex items-center gap-1">
                  <input
                    type="number"
                    min={0.1}
                    step={0.25}
                    className="input tabular w-16"
                    value={state.portion}
                    onChange={(e) => setState((s) => ({ ...s, portion: Number(e.target.value) || 0 }))}
                  />
                  <span className="text-sm text-muted">of {result ? fmtAmount(result.base.servings) : ""}</span>
                </div>
              </label>
              <button className="btn ml-auto sm:ml-0" onClick={() => setState(fresh(state.baseId, 1))}>Reset</button>
            </div>
            {result?.base.notes && <p className="mt-3 text-sm text-muted">{result.base.notes}</p>}
          </section>

          {/* Base components */}
          <section className="card p-4 sm:p-5">
            <h2 className="label mb-2">In the base · whole batch</h2>
            <ul className="divide-y divide-line">
              {componentLines.map((l) => (
                <ComponentRow
                  key={l.key}
                  line={l}
                  onAmount={(a) => editComponent(l.key, { amount: a })}
                  onRemove={() => editComponent(l.key, { removed: true })}
                  onRestore={() => editComponent(l.key, null)}
                  onSwapOpen={() => setSwapFor(swapFor === l.key ? null : l.key)}
                  swapOpen={swapFor === l.key}
                  swapPicker={
                    <ItemPicker
                      compact
                      baseFirst
                      items={items}
                      defaultKind={l.original?.item.kind ?? l.item.kind}
                      pinnedIds={swapOptionsFor(l.original?.item.id ?? l.item.id, l.item.id)}
                      pinnedLabel="Swap options"
                      emptyPinnedHint={
                        <>
                          No swap options set for {l.original?.item.name ?? l.item.name} in this base yet.{" "}
                          <Link href="/library" className="text-accent underline">Add some in the library</Link>, or pick from the whole library.
                        </>
                      }
                      exclude={[l.item.id]}
                      onPick={(it) => {
                        const origId = l.original?.item.id;
                        editComponent(
                          l.key,
                          it.id === origId ? { swapToId: undefined, amount: undefined } : { swapToId: it.id, amount: undefined },
                        );
                        setSwapFor(null);
                      }}
                    />
                  }
                />
              ))}
            </ul>
          </section>

          {/* Extras */}
          <section className="card p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="label mr-auto">Mix-ins &amp; toppings</h2>
              <div className="flex rounded-lg border border-line p-0.5 text-xs">
                {(["portion", "batch"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setState((st) => ({ ...st, extrasScope: s }))}
                    className={`rounded-md px-2 py-1 ${state.extrasScope === s ? "bg-ink text-bg" : "text-muted"}`}
                  >
                    {s === "portion" ? "On my portion" : "In the whole batch"}
                  </button>
                ))}
              </div>
            </div>
            {extraLines.length > 0 && (
              <ul className="mb-4 divide-y divide-line">
                {extraLines.map((l) => (
                  <li key={l.key} className="flex items-center gap-3 py-2">
                    <span className="flex-1 truncate">{l.label}</span>
                    <AmountInput value={l.amount} unit={l.item.serving_unit} onChange={(a) => setExtraAmount(l.key, a)} />
                    <span className="tabular w-16 text-right text-sm text-bad">+{round(l.macros.calories)}</span>
                    <button onClick={() => removeExtra(l.key)} className="text-muted hover:text-bad" aria-label="Remove">×</button>
                  </li>
                ))}
              </ul>
            )}
            <ItemPicker
              key={state.baseId ?? "none"}
              items={items}
              pinnedIds={result ? [...result.base.addons].sort((a, b) => a.position - b.position).map((a) => a.item_id) : []}
              pinnedLabel={`${result?.base.category ?? "This base"} add-ons`}
              emptyPinnedHint={
                <>
                  No add-ons saved for this base yet.{" "}
                  <Link href="/library" className="text-accent underline">Pick some in the library</Link> or use the whole library.
                </>
              }
              onPick={addExtra}
            />
          </section>
        </div>

        {/* Summary */}
        <aside id="summary" className="space-y-4 pb-20 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:self-start lg:overflow-y-auto lg:pb-0">
          {result && p && (
            <div className="card overflow-hidden">
              <div className="bg-ink p-5 text-bg transition-colors" style={heroStyle}>
                <div className="text-xs uppercase tracking-wider opacity-70">
                  {fmtAmount(state.portion)} of {fmtAmount(result.base.servings)} serving{result.base.servings === 1 ? "" : "s"}
                </div>
                <div className="tabular mt-1 font-display text-6xl leading-none">{p.calories}</div>
                <div className="mt-1 text-sm opacity-80">
                  calories ·{" "}
                  <span className="tabular">
                    {round(result.delta.calories) === 0
                      ? "same as the base"
                      : `${round(result.delta.calories) > 0 ? "+" : "−"}${Math.abs(round(result.delta.calories))} vs base`}
                  </span>
                </div>
                {calTier > 0 && (
                  <div className="mt-2 inline-block rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold">
                    ▲ {calOver.toLocaleString()} over your calorie goal for today
                  </div>
                )}
              </div>
              <div className="space-y-4 p-5">
                <MacroRow m={result.portion} delta={result.delta} tiers={tiers} />
                <p className="text-sm leading-snug">{result.title}</p>
                <div className="flex gap-2">
                  <button className="btn flex-1" onClick={copy}>Copy recipe</button>
                  <button className="btn-primary flex-1" onClick={sendToGrams} disabled={logging}>
                    {logging ? "Logging…" : "Log to GRAMS"}
                  </button>
                </div>
                <p className="text-xs text-muted">
                  Adds one entry to today in GRAMS. Nothing is added to your GRAMS food library.
                </p>
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted">Whole batch totals</summary>
                  <div className="tabular mt-2 space-y-1">
                    <Row label="As written" v={result.original.calories} />
                    <Row
                      label={state.extrasScope === "portion" ? "With swaps (before toppings)" : "With your changes"}
                      v={result.batch.calories}
                    />
                  </div>
                </details>
              </div>
            </div>
          )}
          <GramsToday
            goals={grams.goals}
            eaten={grams.eaten}
            meal={meal}
            count={grams.count}
            loading={grams.loading}
            error={grams.error}
            logged={logged}
          />
          <p className="text-center text-xs text-muted">Nothing here is saved — it&apos;s a calculator.</p>
        </aside>
      </div>

      {/* Phone: keep the total in view while editing */}
      {result && p && (
        <button
          onClick={() => document.getElementById("summary")?.scrollIntoView({ behavior: "smooth" })}
          className="fixed inset-x-3 bottom-3 z-20 flex items-baseline gap-2 rounded-2xl bg-ink px-4 py-3 text-left text-bg shadow-lg lg:hidden"
          style={heroStyle}
        >
          <span className="tabular font-display text-3xl leading-none">{p.calories}</span>
          <span className="text-sm opacity-80">cal</span>
          <span className="tabular ml-auto text-sm opacity-80">
            P {p.protein} · C {p.carbs} · F {p.fat}
          </span>
        </button>
      )}

      {toast && (
        <div className="fixed inset-x-0 bottom-20 z-30 lg:bottom-6 mx-auto w-fit rounded-full bg-ink px-4 py-2 text-sm text-bg shadow-lg">
          {toast}
        </div>
      )}
    </Shell>
  );
}

function Row({ label, v }: { label: string; v: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span>{round(v)} cal</span>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </>
  );
}

function AmountInput({ value, unit, onChange }: { value: number; unit: string; onChange: (n: number) => void }) {
  return (
    <span className="flex items-center gap-1">
      <input
        type="number"
        min={0}
        step="any"
        className="input tabular w-20 px-2 py-1 text-right"
        value={round(value, 1)}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
      <span className="w-8 text-xs text-muted">{unit}</span>
    </span>
  );
}

function ComponentRow({
  line,
  onAmount,
  onRemove,
  onRestore,
  onSwapOpen,
  swapOpen,
  swapPicker,
}: {
  line: Line;
  onAmount: (n: number) => void;
  onRemove: () => void;
  onRestore: () => void;
  onSwapOpen: () => void;
  swapOpen: boolean;
  swapPicker: React.ReactNode;
}) {
  const removed = line.status === "removed";
  const changed = line.status !== "base";
  const diff = line.original ? line.macros.calories - line.original.macros.calories : 0;
  return (
    <li className="py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1">
          <div className={`leading-snug ${removed ? "text-muted line-through" : ""}`}>
            {line.label}
            {line.item.kind !== "ingredient" && (
              <span className="chip ml-2 align-middle">{kindLabel(line.item.kind)}</span>
            )}
          </div>
          {line.status === "swapped" && line.original && (
            <div className="text-xs text-swap">swapped for {line.original.item.name}</div>
          )}
        </div>
        {!removed && <AmountInput value={line.amount} unit={line.item.serving_unit} onChange={onAmount} />}
        <span className="tabular w-16 text-right text-sm">
          {removed ? <Delta value={diff} /> : changed ? <Delta value={diff} /> : <span className="text-muted">{round(line.macros.calories)}</span>}
        </span>
        <span className="flex gap-1">
          {removed ? (
            <button className="btn px-2 py-1 text-xs" onClick={onRestore}>Restore</button>
          ) : (
            <>
              <button className={`btn px-2 py-1 text-xs ${swapOpen ? "border-accent" : ""}`} onClick={onSwapOpen}>Swap</button>
              {changed ? (
                <button className="btn px-2 py-1 text-xs" onClick={onRestore}>Undo</button>
              ) : (
                <button className="btn px-2 py-1 text-xs" onClick={onRemove}>Remove</button>
              )}
            </>
          )}
        </span>
      </div>
      {swapOpen && <div className="mt-3 rounded-xl border border-line p-3">{swapPicker}</div>}
    </li>
  );
}
