"use client";

import { overTier, round, type OverTier } from "@/lib/calc";
import type { GramsGoals } from "@/lib/grams";
import type { Macros } from "@/lib/types";

export const OVER_TEXT: Record<OverTier, string> = {
  0: "",
  1: "text-over-1",
  2: "text-over-2",
  3: "text-over-3",
};
const OVER_FILL: Record<OverTier, string> = {
  0: "var(--meal)",
  1: "var(--over-1)",
  2: "var(--over-2)",
  3: "var(--over-3)",
};

type Key = "calories" | "protein" | "carbs" | "fat";
const ROWS: { key: Key; label: string; unit: string }[] = [
  { key: "calories", label: "Calories", unit: "" },
  { key: "protein", label: "Protein", unit: "g" },
  { key: "carbs", label: "Carbs", unit: "g" },
  { key: "fat", label: "Fat", unit: "g" },
];

/** Over-goal level for each macro once this meal is added to today. */
export function projectedTiers(
  eaten: Macros,
  meal: Macros,
  goals: GramsGoals | null,
): Record<Key, OverTier> {
  const t = (k: Key) => overTier(eaten[k] + meal[k], goals?.[k]);
  return { calories: t("calories"), protein: t("protein"), carbs: t("carbs"), fat: t("fat") };
}

export default function GramsToday({
  goals,
  eaten,
  meal,
  count,
  loading,
  error,
  logged,
}: {
  goals: GramsGoals | null;
  eaten: Macros;
  meal: Macros;
  count: number;
  loading: boolean;
  error: string | null;
  logged: boolean;
}) {
  return (
    <section className="card p-5" aria-label="Today in GRAMS">
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="font-display text-xl">Today in GRAMS</h2>
        <span className="ml-auto text-xs text-muted">
          {loading ? "Loading…" : `${count} entr${count === 1 ? "y" : "ies"} so far`}
        </span>
      </div>

      {error ? (
        <p className="text-sm text-muted">Couldn&apos;t read GRAMS ({error}).</p>
      ) : !loading && !goals ? (
        <p className="text-sm text-muted">Set your goals in GRAMS to see how this fits your day.</p>
      ) : (
        <>
          <ul className="space-y-3.5">
            {ROWS.map(({ key, label, unit }) => (
              <MacroMeter
                key={key}
                label={label}
                unit={unit}
                eaten={eaten[key]}
                meal={meal[key]}
                goal={goals?.[key] ?? 0}
              />
            ))}
            <li className="flex items-baseline justify-between text-sm">
              <span className="text-muted">Fiber</span>
              <span className="tabular">
                {round(eaten.fiber)}g{meal.fiber > 0 && <span className="text-muted"> + {round(meal.fiber)}g</span>}
              </span>
            </li>
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-3 rounded-sm" style={{ background: "var(--eaten)" }} /> Eaten today
            </span>
            {!logged && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-3 rounded-sm" style={{ background: "var(--meal)" }} /> This meal
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-0.5 bg-ink" /> Goal
            </span>
          </div>
          {logged && <p className="mt-2 text-xs text-good">✓ This meal is logged and counted above.</p>}
        </>
      )}
    </section>
  );
}

function MacroMeter({
  label,
  unit,
  eaten,
  meal,
  goal,
}: {
  label: string;
  unit: string;
  eaten: number;
  meal: number;
  goal: number;
}) {
  const total = eaten + meal;
  const tier = overTier(total, goal);
  const scale = Math.max(goal, total, 1);
  const pct = (v: number) => `${(Math.max(0, v) / scale) * 100}%`;
  const left = Math.round(goal - total);
  const fmt = (v: number) => Math.round(v).toLocaleString();

  const summary = goal
    ? `${label}: ${fmt(eaten)}${unit} eaten${meal > 0 ? ` + ${fmt(meal)}${unit} this meal` : ""} of ${fmt(goal)}${unit}. ${
        left >= 0 ? `${fmt(left)}${unit} left` : `${fmt(-left)}${unit} over`
      }.`
    : `${label}: ${fmt(total)}${unit}`;

  return (
    <li title={summary}>
      <div className="flex items-baseline gap-2 text-sm">
        <span className="text-muted">{label}</span>
        <span className={`tabular ml-auto font-semibold ${OVER_TEXT[tier]}`}>
          {fmt(total)}
          {unit}
        </span>
        {goal > 0 && <span className="tabular text-xs text-muted">/ {fmt(goal)}{unit}</span>}
      </div>
      {goal > 0 && (
        <>
          <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-line" role="img" aria-label={summary}>
            <div className="absolute inset-y-0 left-0 flex gap-[2px]" style={{ width: pct(total) }}>
              {eaten > 0 && (
                <span className="h-full rounded-l-full" style={{ width: `${(eaten / Math.max(total, 1)) * 100}%`, background: "var(--eaten)" }} />
              )}
              {meal > 0 && (
                <span className="h-full flex-1 rounded-r-full" style={{ background: OVER_FILL[tier] }} />
              )}
            </div>
            {/* goal marker sits inside the bar once the total runs past it */}
            {total > goal && (
              <span className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: `calc(${pct(goal)} - 1px)` }} />
            )}
          </div>
          <div className={`tabular mt-1 text-xs ${tier ? `font-medium ${OVER_TEXT[tier]}` : "text-muted"}`}>
            {left >= 0 ? `${fmt(left)}${unit} left` : `▲ ${fmt(-left)}${unit} over`}
          </div>
        </>
      )}
    </li>
  );
}
