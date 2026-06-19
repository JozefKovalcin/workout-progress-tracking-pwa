import { addDays } from "date-fns";
import { fromLocalDate, toLocalDate } from "./date";
import type { PerformanceSummary } from "./performance";
import type { RecommendationMetrics } from "./recommendations";
import type { DailyEntry, LocalDate, MacroTargets } from "./types";

export function mean(
  values: Array<number | undefined>
): number | null {
  const present = values.filter(
    (value): value is number => value !== undefined
  );
  if (present.length === 0) {
    return null;
  }
  if (present.some((value) => !Number.isFinite(value))) {
    return Number.NaN;
  }

  return present.reduce((sum, value) => sum + value, 0) / present.length;
}

function finiteCount(values: Array<number | undefined>): number {
  return values.filter(
    (value): value is number =>
      value !== undefined && Number.isFinite(value)
  ).length;
}

function difference(
  current: number | null,
  previous: number | null
): number {
  return current === null ||
    previous === null ||
    !Number.isFinite(current) ||
    !Number.isFinite(previous)
    ? Number.NaN
    : current - previous;
}

function emptyMetrics(
  performance: PerformanceSummary
): RecommendationMetrics {
  return {
    validWeightsWeek1: 0,
    validWeightsWeek2: 0,
    calorieDays: 0,
    waistDays: 0,
    calorieMeanAbsoluteErrorPct: Number.NaN,
    weeklyWeightChangePct: Number.NaN,
    weeklyWeightChangeKg: Number.NaN,
    waistChangeCm: Number.NaN,
    performancePercent: performance.overallPercent,
    repeatedExerciseDecline:
      performance.repeatedDeclineExerciseIds.length > 0,
    averageSleep: null,
    averageReadiness: null,
    averageTrainingQuality: null
  };
}

export function buildEvaluationMetrics(
  entries: DailyEntry[],
  targetForDate: (date: LocalDate) => MacroTargets,
  performance: PerformanceSummary
): RecommendationMetrics {
  if (entries.length === 0) {
    return emptyMetrics(performance);
  }

  const entriesByDate = new Map<LocalDate, DailyEntry>();
  for (const entry of entries) {
    fromLocalDate(entry.date);
    const current = entriesByDate.get(entry.date);
    if (!current || entry.updatedAtMs >= current.updatedAtMs) {
      entriesByDate.set(entry.date, entry);
    }
  }

  const start = [...entriesByDate.keys()].sort()[0];
  const startDate = fromLocalDate(start);
  const blockDates = Array.from({ length: 14 }, (_, index) =>
    toLocalDate(addDays(startDate, index))
  );
  const blockEntries = blockDates
    .map((date) => entriesByDate.get(date))
    .filter((entry): entry is DailyEntry => entry !== undefined);
  const week1Dates = new Set(blockDates.slice(0, 7));
  const week1 = blockEntries.filter((entry) => week1Dates.has(entry.date));
  const week2 = blockEntries.filter((entry) => !week1Dates.has(entry.date));

  const week1Weights = week1.map((entry) => entry.weightKg);
  const week2Weights = week2.map((entry) => entry.weightKg);
  const week1WeightAverage = mean(week1Weights);
  const week2WeightAverage = mean(week2Weights);
  const firstWeekWeight = week1WeightAverage ?? Number.NaN;
  const secondWeekWeight = week2WeightAverage ?? Number.NaN;
  const hasValidWeightAverages =
    firstWeekWeight !== 0 &&
    Number.isFinite(firstWeekWeight) &&
    Number.isFinite(secondWeekWeight);
  const weeklyWeightChangeKg = hasValidWeightAverages
    ? secondWeekWeight - firstWeekWeight
    : Number.NaN;
  const weeklyWeightChangePct = hasValidWeightAverages
    ? (weeklyWeightChangeKg / firstWeekWeight) * 100
    : Number.NaN;

  const week1WaistAverage = mean(week1.map((entry) => entry.waistCm));
  const week2WaistAverage = mean(week2.map((entry) => entry.waistCm));
  const calorieValues = blockEntries.map((entry) => entry.calories);
  const calorieErrors = blockEntries.map((entry) => {
    if (entry.calories === undefined) {
      return undefined;
    }
    if (!Number.isFinite(entry.calories)) {
      return Number.NaN;
    }

    const targetCalories = targetForDate(entry.date).calories;
    if (!Number.isFinite(targetCalories) || targetCalories <= 0) {
      return Number.NaN;
    }

    return (
      (Math.abs(entry.calories - targetCalories) / targetCalories) * 100
    );
  });
  const calorieErrorAverage = mean(calorieErrors);

  return {
    validWeightsWeek1: finiteCount(week1Weights),
    validWeightsWeek2: finiteCount(week2Weights),
    calorieDays: finiteCount(calorieValues),
    waistDays: finiteCount(blockEntries.map((entry) => entry.waistCm)),
    calorieMeanAbsoluteErrorPct:
      calorieErrorAverage === null ? Number.NaN : calorieErrorAverage,
    weeklyWeightChangePct,
    weeklyWeightChangeKg,
    waistChangeCm: difference(week2WaistAverage, week1WaistAverage),
    performancePercent: performance.overallPercent,
    repeatedExerciseDecline:
      performance.repeatedDeclineExerciseIds.length > 0,
    averageSleep: mean(blockEntries.map((entry) => entry.sleepScore)),
    averageReadiness: mean(
      blockEntries.map((entry) => entry.readinessScore)
    ),
    averageTrainingQuality: mean(
      blockEntries.map((entry) => entry.trainingQualityScore)
    )
  };
}
