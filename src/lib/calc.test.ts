import { describe, expect, it } from "vitest";
import { compute, roundMacros, toGramsEntry, type CalcState } from "./calc";
import type { Base, Item } from "./types";

const item = (id: string, kind: Item["kind"], size: number, unit: string, cal: number, p: number, c: number, f: number, fiber = 0): Item => ({
  id, name: id, kind, serving_size: size, serving_unit: unit, calories: cal, protein: p, carbs: c, fat: f, fiber, notes: null,
});

const items: Item[] = [
  item("milk", "ingredient", 240, "ml", 80, 13, 6, 0),
  item("whey", "protein", 31, "g", 120, 24, 3, 1.5),
  item("sugar", "ingredient", 4, "g", 16, 0, 4, 0),
  item("allulose", "ingredient", 8, "g", 0, 0, 8, 0),
  item("pretzels", "mixin", 28, "g", 110, 3, 23, 1, 1),
  item("iso", "protein", 31, "g", 110, 25, 2, 0.5),
];

const base: Base = {
  id: "ic", name: "Ice cream", category: "Ice cream", servings: 2, notes: null, addons: [],
  base_items: [
    { id: "b1", base_id: "ic", item_id: "milk", amount: 360, position: 0 },
    { id: "b2", base_id: "ic", item_id: "whey", amount: 31, position: 1 },
    { id: "b3", base_id: "ic", item_id: "sugar", amount: 8, position: 2 },
  ],
};

const s = (over: Partial<CalcState> = {}): CalcState => ({
  baseId: "ic", edits: {}, extras: [], portion: 2, extrasScope: "batch", ...over,
});

describe("compute", () => {
  it("totals the base as written", () => {
    const r = compute(s(), [base], items)!;
    // milk 1.5 svg = 120 cal, whey 120, sugar 2 svg = 32
    expect(roundMacros(r.batch).calories).toBe(272);
    expect(roundMacros(r.delta).calories).toBe(0);
  });

  it("swaps an ingredient using equivalent servings", () => {
    const r = compute(s({ edits: { b3: { swapToId: "allulose" } } }), [base], items)!;
    const line = r.lines.find((l) => l.key === "b3")!;
    expect(line.amount).toBe(16); // 2 servings of allulose
    expect(roundMacros(r.batch).calories).toBe(240);
    expect(r.title).toBe("Ice cream (w/ allulose)");
  });

  it("removes an ingredient", () => {
    const r = compute(s({ edits: { b2: { removed: true } } }), [base], items)!;
    expect(roundMacros(r.batch).calories).toBe(152);
    expect(roundMacros(r.delta).protein).toBe(-24);
  });

  it("adds a mix-in to the batch and scales to portion", () => {
    const r = compute(s({ portion: 1, extras: [{ key: "x", itemId: "pretzels", amount: 28 }] }), [base], items)!;
    expect(roundMacros(r.portion).calories).toBe(191); // (272+110)/2
    expect(r.title).toBe("Ice cream + pretzels");
  });

  it("adds a topping to the portion only", () => {
    const r = compute(
      s({ portion: 1, extrasScope: "portion", extras: [{ key: "x", itemId: "pretzels", amount: 28 }] }),
      [base], items,
    )!;
    expect(roundMacros(r.portion).calories).toBe(246); // 136 + 110
    expect(roundMacros(r.delta).calories).toBe(110);
  });

  it("swaps one protein brand for another", () => {
    const r = compute(s({ edits: { b2: { swapToId: "iso" } } }), [base], items)!;
    expect(r.lines.find((l) => l.key === "b2")!.amount).toBe(31);
    expect(roundMacros(r.batch).calories).toBe(262);
    expect(roundMacros(r.batch).protein).toBe(44.5);
  });

  it("builds a GRAMS food_entries row", () => {
    const st = s({ portion: 1, extrasScope: "portion", extras: [{ key: "x", itemId: "pretzels", amount: 28 }] });
    const r = compute(st, [base], items)!;
    const row = toGramsEntry(r, st, "user-1", new Date(2026, 9, 4, 21, 30));
    expect(row).toMatchObject({
      user_id: "user-1",
      name: "Ice cream + pretzels",
      calories: 246,
      protein: 25, // (19.5 + 24) / 2 + 3 = 24.75
      fiber: 1,
      micros: {},
      eaten_date: "2026-10-04",
    });
    expect(row.description).toContain("1 of 2 servings");
    expect(Number.isInteger(row.carbs)).toBe(true);
  });
});
