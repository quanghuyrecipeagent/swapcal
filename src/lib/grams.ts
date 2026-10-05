"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "./supabase/client";
import { add, localDate, ZERO } from "./calc";
import type { Macros } from "./types";

/** GRAMS's `goals` row (no fiber goal in GRAMS). */
export interface GramsGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/**
 * Today's totals and goals from GRAMS (same Supabase project).
 * Reads `goals` and today's `food_entries`, exactly what GRAMS's Today view uses.
 */
export function useGramsToday() {
  const [goals, setGoals] = useState<GramsGoals | null>(null);
  const [eaten, setEaten] = useState<Macros>(ZERO);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const sb = createClient();
    const { data: u } = await sb.auth.getUser();
    if (!u.user) {
      setLoading(false);
      return;
    }
    const [g, fe] = await Promise.all([
      sb.from("goals").select("calories,protein,carbs,fat").eq("user_id", u.user.id).maybeSingle(),
      sb
        .from("food_entries")
        .select("calories,protein,carbs,fat,fiber")
        .eq("user_id", u.user.id)
        .eq("eaten_date", localDate(new Date())),
    ]);
    if (g.error || fe.error) {
      setError((g.error ?? fe.error)!.message);
    } else {
      const row = g.data as Partial<GramsGoals> | null;
      setGoals(
        row
          ? {
              calories: Number(row.calories) || 0,
              protein: Number(row.protein) || 0,
              carbs: Number(row.carbs) || 0,
              fat: Number(row.fat) || 0,
            }
          : null,
      );
      const rows = (fe.data ?? []) as Partial<Macros>[];
      setEaten(
        rows.reduce<Macros>(
          (acc, r) =>
            add(acc, {
              calories: Number(r.calories) || 0,
              protein: Number(r.protein) || 0,
              carbs: Number(r.carbs) || 0,
              fat: Number(r.fat) || 0,
              fiber: Number(r.fiber) || 0,
            }),
          ZERO,
        ),
      );
      setCount(rows.length);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    // pick up anything logged in GRAMS while this tab was in the background
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  return { goals, eaten, count, loading, error, refresh };
}
