import type { DailyEntry, TopSet } from "./types";

function isOutsideOptionalRange(value: number | undefined, min: number, max: number): boolean {
  return value !== undefined && (value < min || value > max);
}

export function validateDailyEntry(entry: DailyEntry): string[] {
  const errors: string[] = [];

  if (isOutsideOptionalRange(entry.weightKg, 30, 300)) {
    errors.push("Váha musí byť medzi 30 a 300 kg.");
  }
  if (isOutsideOptionalRange(entry.waistCm, 40, 250)) {
    errors.push("Pás musí byť medzi 40 a 250 cm.");
  }
  if (isOutsideOptionalRange(entry.calories, 0, 10_000)) {
    errors.push("Kalórie musia byť medzi 0 a 10 000.");
  }
  if (isOutsideOptionalRange(entry.sleepScore, 1, 10)) {
    errors.push("Spánok musí byť na škále 1–10.");
  }
  if (isOutsideOptionalRange(entry.readinessScore, 1, 10)) {
    errors.push("Pripravenosť musí byť na škále 1–10.");
  }
  if (isOutsideOptionalRange(entry.trainingQualityScore, 1, 10)) {
    errors.push("Kvalita tréningu musí byť na škále 1–10.");
  }

  return errors;
}

export function validateTopSet(topSet: TopSet): string[] {
  const errors: string[] = [];

  if (topSet.weightKg <= 0 || topSet.weightKg > 1000) {
    errors.push("Top set: Váha musí byť väčšia ako 0 kg.");
  }
  if (!Number.isInteger(topSet.reps) || topSet.reps < 1 || topSet.reps > 100) {
    errors.push("Opakovania musia byť 1–100.");
  }
  if (topSet.rir < 0 || topSet.rir > 10) {
    errors.push("RIR musí byť 0–10.");
  }

  return errors;
}
