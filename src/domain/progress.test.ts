import { describe, expect, it } from "vitest";
import { makeDailyEntry, makeTopSet } from "../test/fixtures";
import {
  buildDailySeries,
  buildStrengthSeries,
  type ProgressRange
} from "./progress";

describe("buildDailySeries", () => {
  const entries = [
    makeDailyEntry({ date: "2026-03-01", weightKg: 78, waistCm: 80, calories: 2700 }),
    makeDailyEntry({ date: "2026-05-21", weightKg: 79, waistCm: 81, calories: 2800 }),
    makeDailyEntry({ date: "2026-06-01", weightKg: 80, waistCm: 82, calories: 2900 }),
    makeDailyEntry({ date: "2026-06-14", weightKg: 81, waistCm: 83, calories: 3000 }),
    makeDailyEntry({ date: "2026-06-20", weightKg: 82, waistCm: 84, calories: 3100 })
  ];

  it.each([
    [7, ["2026-06-14", "2026-06-20"]],
    [30, ["2026-06-01", "2026-06-14", "2026-06-20"]],
    [90, ["2026-05-21", "2026-06-01", "2026-06-14", "2026-06-20"]],
    ["all", ["2026-03-01", "2026-05-21", "2026-06-01", "2026-06-14", "2026-06-20"]]
  ] satisfies Array<[ProgressRange, string[]]>)(
    "filters the %s-day range inclusively",
    (range, dates) => {
      expect(
        buildDailySeries(entries, "weightKg", "2026-06-20", range)
          .map((point) => point.date)
      ).toEqual(dates);
    }
  );

  it("ignores missing values and returns the requested metric", () => {
    const rows = [
      makeDailyEntry({ date: "2026-06-19", calories: 2900 }),
      makeDailyEntry({ date: "2026-06-20", calories: undefined })
    ];

    expect(buildDailySeries(rows, "calories", "2026-06-20", 7)).toEqual([
      { date: "2026-06-19", value: 2900 }
    ]);
  });
});

describe("buildStrengthSeries", () => {
  it("uses average two-set e1RM and keeps legacy one-set records", () => {
    const sets = [
      makeTopSet({
        id: "old",
        date: "2026-06-10",
        exerciseId: "bench",
        estimated1RmKg: 100
      }),
      makeTopSet({
        id: "new",
        date: "2026-06-20",
        exerciseId: "bench",
        sets: [
          { weightKg: 100, reps: 6, rir: 2, estimated1RmKg: 120 },
          { weightKg: 90, reps: 10, rir: 1, estimated1RmKg: 120 }
        ]
      }),
      makeTopSet({
        id: "other",
        date: "2026-06-20",
        exerciseId: "squat",
        estimated1RmKg: 200
      })
    ];

    expect(buildStrengthSeries(sets, "bench", "2026-06-20", 30)).toEqual([
      { date: "2026-06-10", value: 100 },
      { date: "2026-06-20", value: 120 }
    ]);
  });
});
