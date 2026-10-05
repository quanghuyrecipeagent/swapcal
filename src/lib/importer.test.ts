import { describe, expect, it } from "vitest";
import { parseImport } from "./importer";
import { builtItemMacros } from "./calc";
import type { Item } from "./types";

describe("parseImport", () => {
  it("reads plain CSV in the default column order", () => {
    const r = parseImport("Mini pretzels, mixin, 28, g, 110, 3, 23, 1, 1");
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toMatchObject({ name: "Mini pretzels", kind: "mixin", serving_size: 28, calories: 110, fiber: 1 });
  });

  it("reads a spreadsheet paste with headers in any order and aliases", () => {
    const r = parseImport("Name\tCal\tP\tC\tF\tServing\tCategory\nPB2\t60\t6\t5\t1.5\t13g\tSauces");
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toMatchObject({ name: "PB2", calories: 60, protein: 6, serving_size: 13, serving_unit: "g", kind: "sauce" });
  });

  it("handles quoted names with commas and reports bad rows", () => {
    const r = parseImport('"Yogurt, plain nonfat",ingredient,170,g,90,16,6,0\nBad row,topping,abc,g,1,1,1,1', "topping");
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].name).toBe("Yogurt, plain nonfat");
    expect(r.errors[0]).toContain("Bad row");
  });

  it("rejects junk values and rows without calories", () => {
    const r = parseImport("Name\tCal\tP\tServing\nbad line\tx\nno cals\t\t3\t10g\nok\t110kcal\t3g\t28g");
    expect(r.rows.map((x) => x.name)).toEqual(["ok"]);
    expect(r.rows[0]).toMatchObject({ calories: 110, protein: 3, serving_size: 28 });
    expect(r.errors).toHaveLength(2);
  });

  it("uses the fallback category when none is given", () => {
    const r = parseImport("Honey,,21,g,64,0,17,0", "drizzle");
    expect(r.rows[0].kind).toBe("drizzle");
  });
});

describe("builtItemMacros", () => {
  const it2 = (id: string, size: number, cal: number, p: number): Item => ({
    id, name: id, kind: "ingredient", serving_size: size, serving_unit: "g",
    calories: cal, protein: p, carbs: 0, fat: 0, fiber: 0, notes: null,
  });
  it("divides the recipe total by yield to get per-serving macros", () => {
    const items = [it2("pb2", 13, 60, 6), it2("water", 100, 0, 0)];
    // 52 g PB2 (4 svg = 240 cal) + 120 g water → makes 172 g, serving 43 g
    const r = builtItemMacros(
      [{ component_id: "pb2", amount: 52 }, { component_id: "water", amount: 120 }],
      items, 172, 43,
    );
    expect(r.total.calories).toBe(240);
    expect(r.perServing.calories).toBe(60);
    expect(r.perServing.protein).toBe(6);
  });
});
