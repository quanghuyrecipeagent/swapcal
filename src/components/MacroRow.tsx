import { roundMacros, type OverTier } from "@/lib/calc";
import type { Macros } from "@/lib/types";
import { OVER_TEXT } from "./GramsToday";

export function Delta({ value, unit = "", dp = 0 }: { value: number; unit?: string; dp?: number }) {
  const f = 10 ** dp;
  const v = Math.round(value * f) / f;
  if (v === 0) return <span className="text-muted">±0{unit}</span>;
  // fewer calories reads as "good" in green; more reads as red
  return (
    <span className={v < 0 ? "text-good" : "text-bad"}>
      {v > 0 ? "+" : "−"}
      {Math.abs(v)}
      {unit}
    </span>
  );
}

type Tiers = Partial<Record<"protein" | "carbs" | "fat", OverTier>>;

export default function MacroRow({ m, delta, tiers = {} }: { m: Macros; delta?: Macros; tiers?: Tiers }) {
  const r = roundMacros(m);
  const cell = (label: string, v: number, unit: string, d?: number, tier: OverTier = 0) => (
    <div>
      <div className="label">{label}</div>
      <div className={`tabular text-lg font-semibold ${OVER_TEXT[tier]}`}>
        {v}
        <span className={`text-sm font-normal ${tier ? "" : "text-muted"}`}>{unit}</span>
      </div>
      {d !== undefined && (
        <div className="tabular text-xs">
          <Delta value={d} unit={unit} />
        </div>
      )}
      {tier > 0 && <div className={`whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide ${OVER_TEXT[tier]}`}>▲ over</div>}
    </div>
  );
  return (
    <div className="grid grid-cols-4 gap-3">
      {cell("Protein", r.protein, "g", delta?.protein, tiers.protein)}
      {cell("Carbs", r.carbs, "g", delta?.carbs, tiers.carbs)}
      {cell("Fat", r.fat, "g", delta?.fat, tiers.fat)}
      {cell("Fiber", r.fiber, "g", delta?.fiber)}
    </div>
  );
}
