import { addDays } from "date-fns";
import { describe, expect, it, vi } from "vitest";
import { fromLocalDate, toLocalDate } from "./date";
import { buildEvaluationMetrics, mean } from "./analytics";
import type { PerformanceSummary } from "./performance";
import type { DailyEntry, LocalDate, MacroTargets } from "./types";

const TARGET: MacroTargets = {
  calories: 2_500,
  proteinGrams: 180,
  carbsGrams: 300,
  fatGrams: 75
};

const PERFORMANCE: PerformanceSummary = {
  overallPercent: 2.5,
  comparableExercises: 1,
  items: [],
  repeatedDeclineExerciseIds: []
};

function dateAt(offset: number): LocalDate {
  return toLocalDate(addDays(fromLocalDate("2026-06-01"), offset));
}

function entry(offset: number, overrides: Partial<DailyEntry> = {}): DailyEntry {
  return {
    date: dateAt(offset),
    updatedAtMs: offset + 1,
    ...overrides
  };
}

function build(
  entries: DailyEntry[],
  targetForDate: (date: LocalDate) => MacroTargets = () => TARGET,
  performance: PerformanceSummary = PERFORMANCE
) {
  return buildEvaluationMetrics(entries, targetForDate, performance);
}

describe("mean", () => {
  it("averages finite present values and ignores undefined", () => {
    expect(mean([1, undefined, 3])).toBe(2);
    expect(mean([undefined])).toBeNull();
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "returns NaN when a supplied value is non-finite: %s",
    (value) => {
      expect(mean([1, value, undefined])).toBeNaN();
    }
  );
});

describe("buildEvaluationMetrics", () => {
  it("aggregates the required complete fourteen-day example", () => {
    const entries = Array.from({ length: 14 }, (_, index) =>
      entry(index, {
        weightKg: index < 7 ? 81.4 : 81.6,
        waistCm: index < 7 ? 80 : 80.2,
        calories: TARGET.calories
      })
    );

    const metrics = build(entries);

    expect(metrics.validWeightsWeek1).toBe(7);
    expect(metrics.validWeightsWeek2).toBe(7);
    expect(metrics.calorieDays).toBe(14);
    expect(metrics.waistDays).toBe(14);
    expect(metrics.weeklyWeightChangeKg).toBeCloseTo(0.2);
    expect(metrics.weeklyWeightChangePct).toBeCloseTo((0.2 / 81.4) * 100);
    expect(metrics.waistChangeCm).toBeCloseTo(0.2);
    expect(metrics.calorieMeanAbsoluteErrorPct).toBe(0);
  });

  it("keeps fixed calendar week boundaries when a day is missing", () => {
    const metrics = build([
      entry(0, { weightKg: 80 }),
      entry(6, { weightKg: 82 }),
      entry(7, { weightKg: 90 }),
      entry(8, { weightKg: 92 })
    ]);

    expect(metrics.validWeightsWeek1).toBe(2);
    expect(metrics.validWeightsWeek2).toBe(2);
    expect(metrics.weeklyWeightChangeKg).toBe(10);
  });

  it("returns invalid weight changes when the first-week average is zero", () => {
    const metrics = build([
      entry(0, { weightKg: 0 }),
      entry(7, { weightKg: 1 })
    ]);

    expect(metrics.weeklyWeightChangeKg).toBeNaN();
    expect(metrics.weeklyWeightChangePct).toBeNaN();
  });

  it("uses the latest duplicate entry and counts its date once", () => {
    const metrics = build([
      entry(0, { weightKg: 70, calories: 2_000, updatedAtMs: 100 }),
      entry(0, { weightKg: 80, calories: 2_500, updatedAtMs: 200 }),
      entry(7, { weightKg: 90, updatedAtMs: 300 })
    ]);

    expect(metrics.validWeightsWeek1).toBe(1);
    expect(metrics.validWeightsWeek2).toBe(1);
    expect(metrics.calorieDays).toBe(1);
    expect(metrics.weeklyWeightChangeKg).toBe(10);
    expect(metrics.calorieMeanAbsoluteErrorPct).toBe(0);
  });

  it("uses the day-specific target callback for mixed targets", () => {
    const targetForDate = vi.fn((date: LocalDate) => ({
      ...TARGET,
      calories: date === dateAt(0) ? 3_000 : 2_000
    }));

    const metrics = build(
      [
        entry(0, { calories: 3_000 }),
        entry(1, { calories: 2_000 })
      ],
      targetForDate
    );

    expect(metrics.calorieMeanAbsoluteErrorPct).toBe(0);
    expect(targetForDate).toHaveBeenCalledWith(dateAt(0));
    expect(targetForDate).toHaveBeenCalledWith(dateAt(1));
  });

  it("calculates calorie mean absolute percentage error", () => {
    const metrics = build([
      entry(0, { calories: 2_250 }),
      entry(1, { calories: 3_000 })
    ]);

    expect(metrics.calorieMeanAbsoluteErrorPct).toBe(15);
  });

  it("returns empty counts, invalid trends, null subjectives, and performance passthrough", () => {
    const performance = {
      ...PERFORMANCE,
      overallPercent: null,
      repeatedDeclineExerciseIds: ["squat"]
    };

    const metrics = build([], undefined, performance);

    expect(metrics).toEqual({
      validWeightsWeek1: 0,
      validWeightsWeek2: 0,
      calorieDays: 0,
      waistDays: 0,
      calorieMeanAbsoluteErrorPct: Number.NaN,
      weeklyWeightChangePct: Number.NaN,
      weeklyWeightChangeKg: Number.NaN,
      waistChangeCm: Number.NaN,
      performancePercent: null,
      repeatedExerciseDecline: true,
      averageSleep: null,
      averageReadiness: null,
      averageTrainingQuality: null
    });
  });

  it("counts only finite present values and leaves absent averages null", () => {
    const metrics = build([
      entry(0, { weightKg: 80, calories: 2_500 }),
      entry(7, { weightKg: 81 })
    ]);

    expect(metrics.validWeightsWeek1).toBe(1);
    expect(metrics.validWeightsWeek2).toBe(1);
    expect(metrics.calorieDays).toBe(1);
    expect(metrics.waistDays).toBe(0);
    expect(metrics.waistChangeCm).toBeNaN();
    expect(metrics.averageSleep).toBeNull();
    expect(metrics.averageReadiness).toBeNull();
    expect(metrics.averageTrainingQuality).toBeNull();
  });

  it("poisons each corresponding output when an entry supplies a non-finite value", () => {
    const metrics = build([
      entry(0, {
        weightKg: Number.NaN,
        waistCm: Number.POSITIVE_INFINITY,
        calories: Number.NEGATIVE_INFINITY,
        sleepScore: Number.NaN,
        readinessScore: Number.POSITIVE_INFINITY,
        trainingQualityScore: Number.NEGATIVE_INFINITY
      }),
      entry(7, { weightKg: 81, waistCm: 80, calories: 2_500 })
    ]);

    expect(metrics.validWeightsWeek1).toBe(0);
    expect(metrics.validWeightsWeek2).toBe(1);
    expect(metrics.calorieDays).toBe(1);
    expect(metrics.waistDays).toBe(1);
    expect(metrics.weeklyWeightChangeKg).toBeNaN();
    expect(metrics.weeklyWeightChangePct).toBeNaN();
    expect(metrics.waistChangeCm).toBeNaN();
    expect(metrics.calorieMeanAbsoluteErrorPct).toBeNaN();
    expect(metrics.averageSleep).toBeNaN();
    expect(metrics.averageReadiness).toBeNaN();
    expect(metrics.averageTrainingQuality).toBeNaN();
  });

  it.each([0, Number.NaN, Number.POSITIVE_INFINITY])(
    "returns invalid calorie adherence for target calories %s",
    (calories) => {
      const metrics = build(
        [entry(0, { calories: 2_500 })],
        () => ({ ...TARGET, calories })
      );

      expect(metrics.calorieDays).toBe(1);
      expect(metrics.calorieMeanAbsoluteErrorPct).toBeNaN();
    }
  );

  it("calculates waist change across the fixed weeks", () => {
    const metrics = build([
      entry(0, { waistCm: 80 }),
      entry(6, { waistCm: 82 }),
      entry(7, { waistCm: 83 }),
      entry(13, { waistCm: 85 })
    ]);

    expect(metrics.waistDays).toBe(4);
    expect(metrics.waistChangeCm).toBe(3);
  });

  it("averages subjective scores across the block", () => {
    const metrics = build([
      entry(0, {
        sleepScore: 6,
        readinessScore: 5,
        trainingQualityScore: 7
      }),
      entry(1, {
        sleepScore: 8,
        readinessScore: 9
      }),
      entry(7, { trainingQualityScore: 9 })
    ]);

    expect(metrics.averageSleep).toBe(7);
    expect(metrics.averageReadiness).toBe(7);
    expect(metrics.averageTrainingQuality).toBe(8);
  });

  it("passes through performance and derives the repeated-decline flag", () => {
    expect(
      build([], undefined, {
        ...PERFORMANCE,
        overallPercent: null,
        repeatedDeclineExerciseIds: []
      })
    ).toEqual(
      expect.objectContaining({
        performancePercent: null,
        repeatedExerciseDecline: false
      })
    );

    expect(
      build([], undefined, {
        ...PERFORMANCE,
        overallPercent: -1.2,
        repeatedDeclineExerciseIds: ["bench"]
      })
    ).toEqual(
      expect.objectContaining({
        performancePercent: -1.2,
        repeatedExerciseDecline: true
      })
    );
  });

  it("ignores entries beyond the first fourteen calendar dates", () => {
    const metrics = build([
      entry(0, { weightKg: 80, calories: 2_500 }),
      entry(7, { weightKg: 81, calories: 2_500 }),
      entry(14, {
        weightKg: 200,
        waistCm: 200,
        calories: 10_000,
        sleepScore: 1
      })
    ]);

    expect(metrics.validWeightsWeek2).toBe(1);
    expect(metrics.calorieDays).toBe(2);
    expect(metrics.waistDays).toBe(0);
    expect(metrics.weeklyWeightChangeKg).toBe(1);
    expect(metrics.averageSleep).toBeNull();
  });

  it("strictly validates supplied local dates", () => {
    expect(() =>
      build([
        {
          date: "2026-02-30" as LocalDate,
          updatedAtMs: 1
        }
      ])
    ).toThrow(
      'Invalid local date "2026-02-30": expected a real calendar date in YYYY-MM-DD format'
    );
  });
});
