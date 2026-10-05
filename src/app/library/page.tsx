"use client";

import { useState } from "react";
import Nav from "@/components/Nav";
import BasesTab from "@/components/library/BasesTab";
import ItemsTab from "@/components/library/ItemsTab";
import { useLibrary } from "@/lib/data";

export default function LibraryPage() {
  const { items, bases, loading, error, reload } = useLibrary();
  const [tab, setTab] = useState<"bases" | "items">("bases");

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6 flex flex-wrap items-end gap-4">
          <h1 className="mr-auto font-display text-3xl">Library</h1>
          <div className="flex rounded-lg border border-line p-0.5 text-sm">
            {(["bases", "items"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-md px-3 py-1 ${tab === t ? "bg-ink text-bg" : "text-muted"}`}
              >
                {t === "bases" ? `Bases (${bases.length})` : `Ingredients & add-ons (${items.length})`}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <p className="text-muted">Loading…</p>
        ) : error ? (
          <p className="text-bad">{error}</p>
        ) : tab === "bases" ? (
          <BasesTab items={items} bases={bases} reload={reload} />
        ) : (
          <ItemsTab items={items} reload={reload} />
        )}
      </main>
    </>
  );
}
