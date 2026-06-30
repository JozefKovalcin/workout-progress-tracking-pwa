import { describe, expect, it } from "vitest";
import { CALIBRATION_PROFILE, DEFAULT_EXERCISES, DEFAULT_TRAINING_DAYS } from "../domain/defaults";
import { calculateMacros } from "../domain/macros";
import { normalizeImportedSnapshot } from "./importData";

const validExport = {
  profile: CALIBRATION_PROFILE,
  dailyEntries: [{
    date: "2026-06-19",
    weightKg: 81.4,
    waistCm: 82,
    calories: 2900,
    sleepScore: 8,
    readinessScore: 8,
    trainingQualityScore: 8,
    updatedAtMs: 1
  }],
  exercises: DEFAULT_EXERCISES.slice(0, 1),
  trainingDays: DEFAULT_TRAINING_DAYS.slice(0, 1),
  topSets: [],
  targets: [{
    id: CALIBRATION_PROFILE.startDate,
    effectiveDate: CALIBRATION_PROFILE.startDate,
    training: calculateMacros(2900, 180, 50),
    rest: calculateMacros(2700, 180, 50),
    reason: "Initial",
    createdAtMs: 1
  }],
  recommendations: []
};

describe("import data validation", () => {
  it("normalizes a complete tracker export", () => {
    const result = normalizeImportedSnapshot(validExport);

    expect(result.dailyEntries).toHaveLength(1);
    expect(result.exercises[0]).toMatchObject({ id: DEFAULT_EXERCISES[0].id });
    expect(result.trainingDays[0]).toMatchObject({ weekday: 1 });
    expect(result.profile?.evaluationDays).toBe(14);
  });

  it("normalizes category assignments on training days", () => {
    const result = normalizeImportedSnapshot({
      ...validExport,
      trainingDays: [{
        ...DEFAULT_TRAINING_DAYS[0],
        categoryNames: ["Hrudník", "Triceps"]
      }]
    });

    expect(result.trainingDays[0]).toMatchObject({
      exerciseIds: DEFAULT_TRAINING_DAYS[0].exerciseIds,
      categoryNames: ["Hrudník", "Triceps"]
    });
  });

  it("rejects malformed daily values instead of importing unsafe data", () => {
    expect(() => normalizeImportedSnapshot({
      ...validExport,
      dailyEntries: [{ ...validExport.dailyEntries[0], weightKg: 5 }]
    })).toThrow("Denný záznam 2026-06-19 nie je platný.");
  });

  it("rejects missing required top-level collections", () => {
    const missingExercises: Partial<typeof validExport> = { ...validExport };
    delete missingExercises.exercises;

    expect(() => normalizeImportedSnapshot(missingExercises)).toThrow("Importovaný JSON nemá očakávaný formát.");
  });
});
