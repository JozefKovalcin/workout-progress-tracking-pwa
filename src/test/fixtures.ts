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

export const makeTopSet = (overrides: Partial<TopSet> = {}): TopSet => {
  const date = overrides.date ?? "2026-06-19";
  const exerciseId = overrides.exerciseId ?? "rdl";
  const weightKg = overrides.weightKg ?? 100;
  const reps = overrides.reps ?? 8;
  const rir = overrides.rir ?? 1;

  return {
    ...overrides,
    id: overrides.id ?? `${date}__${exerciseId}`,
    date,
    exerciseId,
    weightKg,
    reps,
    rir,
    estimated1RmKg: overrides.estimated1RmKg ?? weightKg * (1 + reps / 30),
    updatedAtMs: overrides.updatedAtMs ?? 1
  };
};
