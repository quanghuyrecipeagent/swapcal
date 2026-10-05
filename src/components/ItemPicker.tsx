"use client";

import { useMemo, useState } from "react";
import { isBaseKind, kindLabel, kindPlural, type Item, type ItemKind } from "@/lib/types";
import { round } from "@/lib/calc";

function rank(kind: string, baseFirst: boolean): number {
  // add-on categories first (or last), protein/ingredient after (or before)
  const base = kind === "ingredient" ? 1 : kind === "protein" ? 0 : -1;
  if (base === -1) return baseFirst ? 2 : 0;
  return baseFirst ? base : 1 + (1 - base);
}

export default function ItemPicker({
  items,
  onPick,
  defaultKind = "all",
  exclude = [],
  compact = false,
  baseFirst = false,
  pinnedIds,
  pinnedLabel = "Goes with this base",
  emptyPinnedHint,
  selectedIds,
}: {
  items: Item[];
  onPick: (item: Item) => void;
  defaultKind?: ItemKind | "all";
  exclude?: string[];
  compact?: boolean;
  /** List base ingredients and proteins before add-ons. */
  baseFirst?: boolean;
  /** When given, the picker opens on just these items with a toggle to the full library. */
  pinnedIds?: string[];
  pinnedLabel?: string;
  emptyPinnedHint?: React.ReactNode;
  /** Multi-select mode: rows show a checkbox; onPick toggles. */
  selectedIds?: string[];
}) {
  const hasPinned = pinnedIds !== undefined;
  const [scope, setScope] = useState<"pinned" | "all">(
    hasPinned && pinnedIds!.length ? "pinned" : "all",
  );
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<ItemKind | "all">(defaultKind);

  const scoped = useMemo(() => {
    if (scope === "pinned" && pinnedIds) {
      const order = new Map(pinnedIds.map((id, i) => [id, i]));
      return items.filter((i) => order.has(i.id));
    }
    return items;
  }, [items, scope, pinnedIds]);

  const kinds = useMemo(() => {
    const set = new Set(scoped.map((i) => i.kind));
    return [...set].sort((a, b) => rank(a, baseFirst) - rank(b, baseFirst) || a.localeCompare(b));
  }, [scoped, baseFirst]);

  const activeKind = kind !== "all" && !kinds.includes(kind) ? "all" : kind;

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return scoped
      .filter(
        (i) =>
          !exclude.includes(i.id) &&
          (activeKind === "all" || i.kind === activeKind) &&
          (!s || i.name.toLowerCase().includes(s)),
      )
      .sort(
        (a, b) =>
          rank(a.kind, baseFirst) - rank(b.kind, baseFirst) ||
          a.kind.localeCompare(b.kind) ||
          a.name.localeCompare(b.name),
      );
  }, [scoped, q, activeKind, exclude, baseFirst]);

  return (
    <div className="space-y-2">
      {hasPinned && (
        <div className="flex rounded-lg border border-line p-0.5 text-xs">
          {(["pinned", "all"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              className={`flex-1 rounded-md px-2 py-1 ${scope === s ? "bg-ink text-bg" : "text-muted"}`}
            >
              {s === "pinned" ? `${pinnedLabel} (${pinnedIds!.length})` : "Whole library"}
            </button>
          ))}
        </div>
      )}
      <input
        className="input w-full"
        placeholder={scope === "pinned" ? `Search ${pinnedLabel.replace(/ \(.*\)$/, "").toLowerCase()}…` : "Search library…"}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {kinds.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {(["all", ...kinds] as string[]).map((k) => (
            <button
              type="button"
              key={k}
              onClick={() => setKind(k)}
              className={`chip ${activeKind === k ? "border-accent text-accent" : ""}`}
            >
              {k === "all" ? "All" : kindPlural(k)}
            </button>
          ))}
        </div>
      )}
      <ul className={`divide-y divide-line overflow-y-auto ${compact ? "max-h-56" : "max-h-80"}`}>
        {list.length === 0 && (
          <li className="py-3 text-sm text-muted">
            {scope === "pinned" && !q && emptyPinnedHint ? emptyPinnedHint : "Nothing matches."}
          </li>
        )}
        {list.map((i) => {
          const checked = selectedIds?.includes(i.id);
          return (
          <li key={i.id}>
            <button
              type="button"
              role={selectedIds ? "checkbox" : undefined}
              aria-checked={selectedIds ? checked : undefined}
              onClick={() => onPick(i)}
              className={`flex w-full items-center gap-3 py-2 text-left hover:text-accent ${checked ? "text-accent" : ""}`}
            >
              {selectedIds && (
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${checked ? "border-accent bg-accent text-[var(--accent-ink)]" : "border-line"}`}>
                  {checked ? "✓" : ""}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate">
                {i.name}
                {activeKind === "all" && !isBaseKind(i.kind) && kinds.length > 1 && (
                  <span className="ml-2 text-xs text-muted">{kindLabel(i.kind)}</span>
                )}
              </span>
              <span className="tabular shrink-0 text-xs text-muted">
                {round(i.calories)} cal / {round(i.serving_size, 1)} {i.serving_unit}
              </span>
              {!selectedIds && <span className="text-lg leading-none text-accent">+</span>}
            </button>
          </li>
          );
        })}
      </ul>
    </div>
  );
}
