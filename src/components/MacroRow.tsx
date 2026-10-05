import { roundMacros } from "@/lib/calc";
import type { Macros } from "@/lib/types";

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

export default function MacroRow({ m, delta }: { m: Macros; delta?: Macros }) {
  const r = roundMacros(m);
  const cell = (label: string, v: number, unit: string, d?: number, dp = 1) => (
    <div>
      <div className="label">{label}</div>
      <div className="tabular text-lg font-semibold">
        {v}
        <span className="text-sm font-normal text-muted">{unit}</span>
      </div>
      {d !== undefined && (
        <div className="tabular text-xs">
          <Delta value={d} unit={unit} dp={dp} />
        </div>
      )}
    </div>
  );
  return (
    <div className="grid grid-cols-4 gap-3">
      {cell("Protein", r.protein, "g", delta?.protein)}
      {cell("Carbs", r.carbs, "g", delta?.carbs)}
      {cell("Fat", r.fat, "g", delta?.fat)}
      {cell("Fiber", r.fiber, "g", delta?.fiber)}
    </div>
  );
}
