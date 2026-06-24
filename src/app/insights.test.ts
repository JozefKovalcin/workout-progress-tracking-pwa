import { describe, expect, it } from "vitest";
import { calculateE1Rm, workoutE1Rm } from "../domain/performance";
import type { DailyEntry, LocalDate, TopSet, TrackerProfile, TrainingDayPlan } from "../domain/types";
import type { TrackerSnapshot } from "../data/trackerData";
import {
  buildBlockCompleteness,
  buildMovingAverageSeries,
  describeTrainingFeedback,
  summarizeTrend
} from "./insights";

const profile: TrackerProfile = {
  startDate: "2026-06-19",
  startingWeightKg: 81.4,
  trainingCalories: 2900,
  restCalories: 2700,
  proteinGrams: 180,
  fatGrams: 50,
  evaluationDays: 14,
  targetGainMinPct: 0.2,
  targetGainMaxPct: 0.35
};

const trainingDays: TrainingDayPlan[] = [
  { weekday: 1, label: "Lower", enabled: true, exerciseIds: [] },
  { weekday: 2, label: "Voľno", enabled: false, exerciseIds: [] },
  { weekday: 3, label: "Upper", enabled: true, exerciseIds: [] },
  { weekday: 4, label: "Voľno", enabled: false, exerciseIds: [] },
  { weekday: 5, label: "Pump", enabled: true, exerciseIds: [] },
  { weekday: 6, label: "Posterior", enabled: true, exerciseIds: [] },
  { weekday: 7, label: "Hrudník", enabled: true, exerciseIds: [] }
];

function snapshot(entries: DailyEntry[]): TrackerSnapshot {
  return {
    profile,
    dailyEntries: entries,
    exercises: [],
    trainingDays,
    topSets: [],
    targets: [{
      id: profile.startDate,
      effectiveDate: profile.startDate,
      training: { calories: 2900, proteinGrams: 180, carbsGrams: 335, fatGrams: 50 },
      rest: { calories: 2700, proteinGrams: 180, carbsGrams: 285, fatGrams: 50 },
      reason: "Initial",
      createdAtMs: 1
    }],
    recommendations: []
  };
}

function topSet(date: LocalDate, weightKg: number, reps: number): TopSet {
  return {
    id: `${date}__bench`,
    date,
    exerciseId: "bench",
    weightKg,
    reps,
    rir: 2,
    estimated1RmKg: calculateE1Rm(weightKg, reps),
    sets: [
      { weightKg, reps, rir: 2, estimated1RmKg: calculateE1Rm(weightKg, reps) },
      { weightKg: weightKg - 10, reps: reps + 2, rir: 2, estimated1RmKg: calculateE1Rm(weightKg - 10, reps + 2) }
    ],
    updatedAtMs: 1
  };
}

describe("app insights", () => {
  it("summarizes missing data for the current 14-day block through today", () => {
    const result = buildBlockCompleteness(snapshot([
      {
        date: "2026-06-19",
        dayTypeOverride: "training",
        weightKg: 81.4,
        calories: 2900,
        trainingQualityScore: 8,
        updatedAtMs: 1
      },
      {
        date: "2026-06-20",
        dayTypeOverride: "rest",
        weightKg: 81.5,
        waistCm: 82,
        updatedAtMs: 2
      }
    ]), "2026-06-20");

    expect(result).toMatchObject({
      blockStart: "2026-06-19",
      blockEnd: "2026-07-02",
      day: 2,
      completed: 5,
      total: 7
    });
    expect(result.missing.weight).toEqual([]);
    expect(result.missing.waist).toEqual(["2026-06-19"]);
    expect(result.missing.calories).toEqual(["2026-06-20"]);
    expect(result.missing.trainingQuality).toEqual([]);
  });

  it("builds a seven-day moving average over available points", () => {
    const series = buildMovingAverageSeries([
      { date: "2026-06-19", value: 80 },
      { date: "2026-06-20", value: 81 },
      { date: "2026-06-21", value: 82 },
      { date: "2026-06-22", value: 83 },
      { date: "2026-06-23", value: 84 },
      { date: "2026-06-24", value: 85 },
      { date: "2026-06-25", value: 86 },
      { date: "2026-06-26", value: 87 }
    ], 7);

    expect(series.at(-1)).toEqual({ date: "2026-06-26", value: 84 });
  });

  it("labels positive, neutral, and negative training feedback", () => {
    const previous = topSet("2026-06-19", 100, 8);
    const baseline = workoutE1Rm(previous);

    expect(describeTrainingFeedback(baseline * 1.02, previous)).toMatchObject({
      tone: "positive",
      label: "Výkon hore"
    });
    expect(describeTrainingFeedback(baseline * 1.002, previous)).toMatchObject({
      tone: "neutral",
      label: "Stabilné"
    });
    expect(describeTrainingFeedback(baseline * 0.98, previous)).toMatchObject({
      tone: "negative",
      label: "Výkon dole"
    });
  });

  it("summarizes trend changes only when two values exist", () => {
    expect(summarizeTrend([{ date: "2026-06-19", value: 80 }], "kg")).toBe("zbieraj merania");
    expect(summarizeTrend([
      { date: "2026-06-19", value: 80 },
      { date: "2026-06-26", value: 81.2 }
    ], "kg")).toBe("+1.2 kg");
  });
});
