import { describe, expect, it } from "vitest";
import { fromLocalDate, toLocalDate, weekdayIso } from "./date";
import { CALIBRATION_PROFILE, DEFAULT_EXERCISES, DEFAULT_TRAINING_DAYS } from "./defaults";
import { makeDailyEntry, makeExercise, makeTopSet } from "../test/fixtures";

describe("default tracker data", () => {
  it("starts the stabilization block on 2026-06-19", () => {
    expect(CALIBRATION_PROFILE).toMatchObject({
      startDate: "2026-06-19",
      startingWeightKg: 81.4,
      trainingCalories: 2900,
      restCalories: 2700,
      proteinGrams: 180,
      fatGrams: 50
    });
  });

  it("uses five enabled training days", () => {
    expect(DEFAULT_TRAINING_DAYS.filter((day) => day.enabled).map((day) => day.weekday))
      .toEqual([1, 3, 5, 6, 7]);
  });

  it("normalizes Flat Bench Press to 6-10 reps", () => {
    expect(DEFAULT_EXERCISES.find((exercise) => exercise.id === "flat-bench-press"))
      .toMatchObject({ repMin: 6, repMax: 10, isMain: true });
  });
});

describe("local dates", () => {
  it("formats and parses calendar dates without a UTC shift", () => {
    const date = new Date(2026, 5, 19);

    expect(toLocalDate(date)).toBe("2026-06-19");
    expect(fromLocalDate("2026-06-19")).toEqual(date);
  });

  it("maps Sunday to ISO weekday 7", () => {
    expect(weekdayIso("2026-06-21")).toBe(7);
    expect(weekdayIso("2026-06-19")).toBe(5);
  });
});

describe("test fixtures", () => {
  it("provides stable domain defaults that can be overridden", () => {
    expect(makeDailyEntry()).toEqual({
      date: "2026-06-19",
      updatedAtMs: 1
    });
    expect(makeExercise()).toEqual({
      id: "rdl",
      name: "RDL",
      muscleGroup: "Hamstringy",
      repMin: 6,
      repMax: 10,
      isMain: true
    });
    expect(makeTopSet({ reps: 9 })).toEqual({
      id: "2026-06-19__rdl",
      date: "2026-06-19",
      exerciseId: "rdl",
      weightKg: 100,
      reps: 9,
      rir: 1,
      estimated1RmKg: 126.6667,
      updatedAtMs: 1
    });
  });
});
