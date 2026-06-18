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
      fatGrams: 50,
      evaluationDays: 14,
      targetGainMinPct: 0.2,
      targetGainMaxPct: 0.35
    });
  });

  it("defines all main exercises in their configured order", () => {
    expect(DEFAULT_EXERCISES).toEqual([
      {
        id: "incline-db-press",
        name: "Incline DB press",
        muscleGroup: "Hrudník",
        repMin: 6,
        repMax: 10,
        isMain: true
      },
      {
        id: "machine-chest-press",
        name: "Machine chest press",
        muscleGroup: "Hrudník",
        repMin: 8,
        repMax: 12,
        isMain: true
      },
      {
        id: "flat-bench-press",
        name: "Flat Bench Press",
        muscleGroup: "Hrudník",
        repMin: 6,
        repMax: 10,
        isMain: true
      },
      {
        id: "chest-supported-row",
        name: "Chest-supported row",
        muscleGroup: "Chrbát",
        repMin: 8,
        repMax: 12,
        isMain: true
      },
      {
        id: "lat-pulldown",
        name: "Lat pulldown",
        muscleGroup: "Chrbát",
        repMin: 8,
        repMax: 12,
        isMain: true
      },
      {
        id: "chin-row",
        name: "Chin row",
        muscleGroup: "Ramená",
        repMin: 10,
        repMax: 15,
        isMain: true
      },
      {
        id: "cable-lateral-raise",
        name: "Cable lateral raise",
        muscleGroup: "Ramená",
        repMin: 8,
        repMax: 15,
        isMain: true
      },
      {
        id: "hack-squat-leg-press",
        name: "Hack squat / leg press",
        muscleGroup: "Quads",
        repMin: 6,
        repMax: 10,
        isMain: true
      },
      {
        id: "seated-lying-leg-curl",
        name: "Seated/lying leg curl",
        muscleGroup: "Hamstringy",
        repMin: 8,
        repMax: 15,
        isMain: true
      },
      {
        id: "rdl",
        name: "RDL",
        muscleGroup: "Hamstringy",
        repMin: 6,
        repMax: 10,
        isMain: true
      },
      {
        id: "hip-thrust",
        name: "Hip thrust",
        muscleGroup: "Glutes",
        repMin: 8,
        repMax: 12,
        isMain: true
      },
      {
        id: "walking-lunge",
        name: "Walking lunge",
        muscleGroup: "Glutes",
        repMin: 10,
        repMax: 15,
        isMain: true
      },
      {
        id: "standing-calf-raise",
        name: "Standing calf raise",
        muscleGroup: "Lýtka",
        repMin: 8,
        repMax: 15,
        isMain: true
      },
      {
        id: "cable-crunch",
        name: "Cable crunch",
        muscleGroup: "Brucho",
        repMin: 10,
        repMax: 20,
        isMain: true
      },
      {
        id: "dragon-flag",
        name: "Dragon Flag",
        muscleGroup: "Brucho",
        repMin: 8,
        repMax: 15,
        isMain: true
      }
    ]);
  });

  it("defines the complete weekly training schedule in weekday order", () => {
    expect(DEFAULT_TRAINING_DAYS).toEqual([
      {
        weekday: 1,
        label: "Lower / quads",
        enabled: true,
        exerciseIds: [
          "hack-squat-leg-press",
          "seated-lying-leg-curl",
          "standing-calf-raise",
          "cable-crunch"
        ]
      },
      { weekday: 2, label: "Voľno", enabled: false, exerciseIds: [] },
      {
        weekday: 3,
        label: "Hrudník priority / pull",
        enabled: true,
        exerciseIds: ["incline-db-press", "chest-supported-row"]
      },
      { weekday: 4, label: "Voľno", enabled: false, exerciseIds: [] },
      {
        weekday: 5,
        label: "Pump / objem",
        enabled: true,
        exerciseIds: ["machine-chest-press", "cable-lateral-raise", "chin-row"]
      },
      {
        weekday: 6,
        label: "Posterior / pull",
        enabled: true,
        exerciseIds: ["rdl", "hip-thrust", "walking-lunge", "lat-pulldown"]
      },
      {
        weekday: 7,
        label: "Hrudník weakpoint / brucho",
        enabled: true,
        exerciseIds: ["flat-bench-press", "dragon-flag"]
      }
    ]);
  });

  it("keeps exercise and schedule relationships internally consistent", () => {
    const exerciseIds = DEFAULT_EXERCISES.map((exercise) => exercise.id);
    const weekdays = DEFAULT_TRAINING_DAYS.map((day) => day.weekday);
    const knownExerciseIds = new Set(exerciseIds);

    expect(new Set(exerciseIds).size).toBe(exerciseIds.length);
    expect(new Set(weekdays).size).toBe(weekdays.length);
    expect(DEFAULT_EXERCISES.every((exercise) => exercise.repMin <= exercise.repMax)).toBe(true);
    expect(
      DEFAULT_TRAINING_DAYS.every((day) =>
        day.exerciseIds.every((exerciseId) => knownExerciseIds.has(exerciseId))
      )
    ).toBe(true);
    expect(
      DEFAULT_TRAINING_DAYS.filter((day) => !day.enabled).every(
        (day) => day.exerciseIds.length === 0
      )
    ).toBe(true);
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
  it("provides stable domain defaults", () => {
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
    expect(makeTopSet()).toEqual({
      id: "2026-06-19__rdl",
      date: "2026-06-19",
      exerciseId: "rdl",
      weightKg: 100,
      reps: 8,
      rir: 1,
      estimated1RmKg: 100 * (1 + 8 / 30),
      updatedAtMs: 1
    });
  });

  it("derives top-set identity and Epley estimate from primary overrides", () => {
    expect(
      makeTopSet({
        date: "2024-02-29",
        exerciseId: "flat-bench-press",
        weightKg: 90,
        reps: 10,
        rir: 2
      })
    ).toEqual({
      id: "2024-02-29__flat-bench-press",
      date: "2024-02-29",
      exerciseId: "flat-bench-press",
      weightKg: 90,
      reps: 10,
      rir: 2,
      estimated1RmKg: 90 * (1 + 10 / 30),
      updatedAtMs: 1
    });
  });

  it("respects explicit top-set derived overrides", () => {
    expect(
      makeTopSet({
        date: "2024-02-29",
        exerciseId: "flat-bench-press",
        weightKg: 90,
        reps: 10,
        id: "custom-id",
        estimated1RmKg: 123.45
      })
    ).toMatchObject({
      id: "custom-id",
      estimated1RmKg: 123.45
    });
  });
});
