import { normalizeKind } from "./types";

export interface ImportRow {
  name: string;
  kind: string;
  serving_size: number;
  serving_unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface ImportResult {
  rows: ImportRow[];
  errors: string[];
}

const HEADER_ALIASES: Record<string, keyof ImportRow> = {
  name: "name", item: "name", food: "name",
  category: "kind", kind: "kind", type: "kind",
  serving: "serving_size", serving_size: "serving_size", size: "serving_size", amount: "serving_size", qty: "serving_size",
  unit: "serving_unit", serving_unit: "serving_unit", units: "serving_unit",
  calories: "calories", cal: "calories", cals: "calories", kcal: "calories",
  protein: "protein", p: "protein", prot: "protein",
  carbs: "carbs", carb: "carbs", c: "carbs", carbohydrates: "carbs",
  fat: "fat", f: "fat", fats: "fat",
  fiber: "fiber", fibre: "fiber", fib: "fiber",
};

const DEFAULT_ORDER: (keyof ImportRow)[] = [
  "name", "kind", "serving_size", "serving_unit", "calories", "protein", "carbs", "fat", "fiber",
];

function splitLine(line: string): string[] {
  if (line.includes("\t")) return line.split("\t").map((s) => s.trim());
  // simple CSV with optional double quotes
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++; }
      else q = !q;
    } else if (ch === "," && !q) { out.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/**
 * Parse pasted rows (CSV, or tab-separated straight from a spreadsheet).
 * Columns: name, category, serving size, unit, calories, protein, carbs, fat, fiber.
 * A header row is optional and may use common aliases (cal, kcal, p, c, f…).
 * "30g" in the serving column is split into 30 + g.
 */
export function parseImport(text: string, fallbackKind = "ingredient"): ImportResult {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows: ImportRow[] = [];
  const errors: string[] = [];
  if (!lines.length) return { rows, errors };

  let order = DEFAULT_ORDER;
  const first = splitLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z_]/g, ""));
  const mapped = first.map((h) => HEADER_ALIASES[h]);
  const isHeader = mapped.filter(Boolean).length >= 2 && mapped.includes("name");
  if (isHeader) {
    order = mapped as (keyof ImportRow)[];
    lines.shift();
  }

  lines.forEach((line, idx) => {
    const cells = splitLine(line);
    const raw: Partial<Record<keyof ImportRow, string>> = {};
    order.forEach((key, i) => { if (key && cells[i] !== undefined) raw[key] = cells[i]; });

    const lineNo = idx + 1 + (isHeader ? 1 : 0);
    if (!raw.name) { errors.push(`Line ${lineNo}: missing name`); return; }

    let size = raw.serving_size ?? "1";
    let unit = raw.serving_unit ?? "";
    const m = size.match(/^\s*([\d.]+)\s*([a-zA-Z]+)?\s*$/);
    if (!m) { errors.push(`Line ${lineNo} (${raw.name}): serving size "${size}" isn't a number`); return; }
    size = m[1];
    if (!unit && m[2]) unit = m[2];

    // accepts "110", "110kcal", "3g"; anything without a number is an error
    const num = (v: string | undefined) => {
      if (v === undefined || v.trim() === "") return 0;
      const m = v.trim().match(/^(\d+(?:\.\d+)?)\s*[a-zA-Z]*$/);
      return m ? Number(m[1]) : NaN;
    };
    if (raw.calories === undefined || raw.calories.trim() === "") {
      errors.push(`Line ${lineNo} (${raw.name}): missing calories`);
      return;
    }
    const values = {
      calories: num(raw.calories), protein: num(raw.protein), carbs: num(raw.carbs),
      fat: num(raw.fat), fiber: num(raw.fiber),
    };
    const bad = Object.entries(values).find(([, v]) => Number.isNaN(v));
    if (bad) { errors.push(`Line ${lineNo} (${raw.name}): ${bad[0]} isn't a number`); return; }
    if (Number(size) <= 0) { errors.push(`Line ${lineNo} (${raw.name}): serving size must be above 0`); return; }

    rows.push({
      name: raw.name,
      kind: raw.kind ? normalizeKind(raw.kind) : fallbackKind,
      serving_size: Number(size),
      serving_unit: unit || "g",
      ...values,
    });
  });

  return { rows, errors };
}
