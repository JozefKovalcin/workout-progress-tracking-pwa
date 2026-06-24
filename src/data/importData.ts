import { isLocalDate } from "../domain/date";
import type {
  DailyEntry,
  Exercise,
  MacroTargets,
  TargetPeriod,
  TopSet,
  TrackerProfile,
  TrainingDayPlan,
  WorkingSet
} from "../domain/types";
import { validateDailyEntry, validateTopSet } from "../domain/validation";
import type { StoredRecommendation, TrackerSnapshot } from "./trackerData";

type Row = Record<string, unknown>;

function isRow(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function text(value: unknown): value is string {
  return typeof value === "string";
}

function expectArray(value: unknown): Row[] {
  if (!Array.isArray(value) || !value.every(isRow)) {
    throw new Error("Importovaný JSON nemá očakávaný formát.");
  }
  return value;
}

function normalizeProfile(value: unknown): TrackerProfile | null {
  if (!isRow(value)) return null;
  if (
    !text(value.startDate) ||
    !isLocalDate(value.startDate) ||
    !finite(value.startingWeightKg) ||
    !finite(value.trainingCalories) ||
    !finite(value.restCalories) ||
    !finite(value.proteinGrams) ||
    !finite(value.fatGrams) ||
    value.evaluationDays !== 14 ||
    !finite(value.targetGainMinPct) ||
    !finite(value.targetGainMaxPct)
  ) {
    throw new Error("Profil v importe nie je platný.");
  }

  return {
    startDate: value.startDate,
    startingWeightKg: value.startingWeightKg,
    trainingCalories: value.trainingCalories,
    restCalories: value.restCalories,
    proteinGrams: value.proteinGrams,
    fatGrams: value.fatGrams,
    evaluationDays: 14,
    targetGainMinPct: value.targetGainMinPct,
    targetGainMaxPct: value.targetGainMaxPct
  };
}

function optionalNumber(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (!finite(value)) throw new Error("Import obsahuje nečíselnú hodnotu.");
  return value;
}

function normalizeDaily(value: Row): DailyEntry {
  if (!text(value.date) || !isLocalDate(value.date) || !finite(value.updatedAtMs)) {
    throw new Error("Denný záznam v importe nie je platný.");
  }
  if (value.dayTypeOverride !== undefined && value.dayTypeOverride !== "training" && value.dayTypeOverride !== "rest") {
    throw new Error(`Denný záznam ${value.date} nie je platný.`);
  }

  const entry: DailyEntry = {
    date: value.date,
    dayTypeOverride: value.dayTypeOverride,
    weightKg: optionalNumber(value.weightKg),
    waistCm: optionalNumber(value.waistCm),
    calories: optionalNumber(value.calories),
    sleepScore: optionalNumber(value.sleepScore),
    readinessScore: optionalNumber(value.readinessScore),
    trainingQualityScore: optionalNumber(value.trainingQualityScore),
    updatedAtMs: value.updatedAtMs
  };
  if (validateDailyEntry(entry).length) {
    throw new Error(`Denný záznam ${entry.date} nie je platný.`);
  }
  return entry;
}

function normalizeExercise(value: Row): Exercise {
  if (
    !text(value.id) ||
    !text(value.name) ||
    !text(value.muscleGroup) ||
    !finite(value.repMin) ||
    !finite(value.repMax) ||
    typeof value.isMain !== "boolean" ||
    (value.archivedAtMs !== undefined && !finite(value.archivedAtMs))
  ) {
    throw new Error("Cvik v importe nie je platný.");
  }

  return {
    id: value.id,
    name: value.name,
    muscleGroup: value.muscleGroup,
    repMin: value.repMin,
    repMax: value.repMax,
    isMain: value.isMain,
    archivedAtMs: value.archivedAtMs
  };
}

function normalizeTrainingDay(value: Row): TrainingDayPlan {
  if (
    !Number.isInteger(value.weekday) ||
    (value.weekday as number) < 1 ||
    (value.weekday as number) > 7 ||
    !text(value.label) ||
    typeof value.enabled !== "boolean" ||
    !Array.isArray(value.exerciseIds) ||
    !value.exerciseIds.every(text)
  ) {
    throw new Error("Tréningový deň v importe nie je platný.");
  }

  return {
    weekday: value.weekday as TrainingDayPlan["weekday"],
    label: value.label,
    enabled: value.enabled,
    exerciseIds: value.exerciseIds
  };
}

function normalizeWorkingSet(value: unknown): WorkingSet {
  if (!isRow(value) || !finite(value.weightKg) || !finite(value.reps) || !finite(value.rir) || !finite(value.estimated1RmKg)) {
    throw new Error("Pracovná séria v importe nie je platná.");
  }
  return {
    weightKg: value.weightKg,
    reps: value.reps,
    rir: value.rir,
    estimated1RmKg: value.estimated1RmKg
  };
}

function normalizeTopSet(value: Row): TopSet {
  if (
    !text(value.id) ||
    !text(value.date) ||
    !isLocalDate(value.date) ||
    !text(value.exerciseId) ||
    !finite(value.weightKg) ||
    !finite(value.reps) ||
    !finite(value.rir) ||
    !finite(value.estimated1RmKg) ||
    !finite(value.updatedAtMs)
  ) {
    throw new Error("Top set v importe nie je platný.");
  }
  const topSet: TopSet = {
    id: value.id,
    date: value.date,
    exerciseId: value.exerciseId,
    weightKg: value.weightKg,
    reps: value.reps,
    rir: value.rir,
    note: text(value.note) ? value.note : undefined,
    estimated1RmKg: value.estimated1RmKg,
    sets: value.sets === undefined ? undefined : expectArray(value.sets).map(normalizeWorkingSet),
    updatedAtMs: value.updatedAtMs
  };
  if (validateTopSet(topSet).length) {
    throw new Error(`Top set ${topSet.id} nie je platný.`);
  }
  return topSet;
}

function normalizeMacro(value: unknown): MacroTargets {
  if (!isRow(value) || !finite(value.calories) || !finite(value.proteinGrams) || !finite(value.carbsGrams) || !finite(value.fatGrams)) {
    throw new Error("Kalorický cieľ v importe nie je platný.");
  }
  return {
    calories: value.calories,
    proteinGrams: value.proteinGrams,
    carbsGrams: value.carbsGrams,
    fatGrams: value.fatGrams
  };
}

function normalizeTarget(value: Row): TargetPeriod {
  if (!text(value.id) || !text(value.effectiveDate) || !isLocalDate(value.effectiveDate) || !text(value.reason) || !finite(value.createdAtMs)) {
    throw new Error("Cieľ v importe nie je platný.");
  }
  return {
    id: value.id,
    effectiveDate: value.effectiveDate,
    training: normalizeMacro(value.training),
    rest: normalizeMacro(value.rest),
    reason: value.reason,
    createdAtMs: value.createdAtMs
  };
}

function normalizeRecommendation(value: Row): StoredRecommendation {
  if (
    !text(value.id) ||
    !text(value.windowStart) ||
    !isLocalDate(value.windowStart) ||
    !text(value.windowEnd) ||
    !isLocalDate(value.windowEnd) ||
    !["pending", "accepted", "rejected", "insufficient", "hold"].includes(String(value.status)) ||
    !text(value.action) ||
    !finite(value.calorieDeltaTraining) ||
    !finite(value.calorieDeltaRest) ||
    !["low", "medium", "high"].includes(String(value.confidence)) ||
    !Array.isArray(value.reasonCodes) ||
    !value.reasonCodes.every(text) ||
    !Array.isArray(value.missingData) ||
    !value.missingData.every(text) ||
    !isRow(value.metrics)
  ) {
    throw new Error("Odporúčanie v importe nie je platné.");
  }

  return value as unknown as StoredRecommendation;
}

export function normalizeImportedSnapshot(value: unknown): TrackerSnapshot {
  if (!isRow(value)) {
    throw new Error("Importovaný JSON nemá očakávaný formát.");
  }

  return {
    profile: normalizeProfile(value.profile),
    dailyEntries: expectArray(value.dailyEntries).map(normalizeDaily),
    exercises: expectArray(value.exercises).map(normalizeExercise),
    trainingDays: expectArray(value.trainingDays).map(normalizeTrainingDay),
    topSets: expectArray(value.topSets).map(normalizeTopSet),
    targets: expectArray(value.targets ?? value.targetHistory).map(normalizeTarget),
    recommendations: expectArray(value.recommendations).map(normalizeRecommendation)
  };
}

