import type { DailyEntry, Exercise, TopSet } from "../domain/types";

export const makeDailyEntry = (overrides: Partial<DailyEntry> = {}): DailyEntry => ({
  date: "2026-06-19",
  updatedAtMs: 1,
  ...overrides
});

export const makeExercise = (overrides: Partial<Exercise> = {}): Exercise => ({
  id: "rdl",
  name: "RDL",
  muscleGroup: "Hamstringy",
  repMin: 6,
  repMax: 10,
  isMain: true,
  ...overrides
});

export const makeTopSet = (overrides: Partial<TopSet> = {}): TopSet => ({
  id: "2026-06-19__rdl",
  date: "2026-06-19",
  exerciseId: "rdl",
  weightKg: 100,
  reps: 8,
  rir: 1,
  estimated1RmKg: 126.6667,
  updatedAtMs: 1,
  ...overrides
});
