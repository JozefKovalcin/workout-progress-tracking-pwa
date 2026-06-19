import type { Confidence, RecommendationStatus } from "./types";

export interface RecommendationMetrics {
  validWeightsWeek1: number;
  validWeightsWeek2: number;
  calorieDays: number;
  waistDays: number;
  calorieMeanAbsoluteErrorPct: number;
  weeklyWeightChangePct: number;
  weeklyWeightChangeKg: number;
  waistChangeCm: number;
  performancePercent: number | null;
  repeatedExerciseDecline: boolean;
  averageSleep: number | null;
  averageReadiness: number | null;
  averageTrainingQuality: number | null;
}

export type RecommendationAction =
  | "increase_training"
  | "increase_all"
  | "decrease_all"
  | "none";

export interface RecommendationResult {
  status: RecommendationStatus;
  action: RecommendationAction;
  calorieDeltaTraining: number;
  calorieDeltaRest: number;
  confidence: Confidence;
  reasonCodes: string[];
  missingData: string[];
}

const WEIGHT_MESSAGE =
  "Potrebných je aspoň 5 vážení v každom porovnávanom týždni.";
const CALORIE_DAYS_MESSAGE =
  "Potrebných je aspoň 10 dní so zapísanými kalóriami.";
const WAIST_DAYS_MESSAGE = "Potrebné sú aspoň 4 merania pásu za 14 dní.";
const CALORIE_ADHERENCE_MESSAGE =
  "Priemerná odchýlka od kalorického cieľa je vyššia než 10 %.";
const INVALID_METRICS_MESSAGE =
  "Vstupné metriky obsahujú neplatné alebo protichodné hodnoty.";
const MISSING_PERFORMANCE_MESSAGE =
  "Na zvýšenie kalórií je potrebný aspoň jeden porovnateľný hlavný cvik.";
const WEIGHT_CHANGE_PCT_EPSILON = 1e-9;
const WEIGHT_CHANGE_KG_EPSILON = 1e-9;

function result(
  status: RecommendationStatus,
  action: RecommendationAction,
  calorieDeltaTraining: number,
  calorieDeltaRest: number,
  confidence: Confidence,
  reasonCodes: string[],
  missingData: string[] = []
): RecommendationResult {
  return {
    status,
    action,
    calorieDeltaTraining,
    calorieDeltaRest,
    confidence,
    reasonCodes,
    missingData
  };
}

function hasInvalidMetrics(metrics: RecommendationMetrics): boolean {
  const counts: Array<[number, number]> = [
    [metrics.validWeightsWeek1, 7],
    [metrics.validWeightsWeek2, 7],
    [metrics.calorieDays, 14],
    [metrics.waistDays, 14]
  ];
  if (
    counts.some(
      ([value, maximum]) =>
        !Number.isFinite(value) ||
        !Number.isInteger(value) ||
        value < 0 ||
        value > maximum
    )
  ) {
    return true;
  }

  if (
    !Number.isFinite(metrics.calorieMeanAbsoluteErrorPct) ||
    metrics.calorieMeanAbsoluteErrorPct < 0
  ) {
    return true;
  }

  const continuousValues = [
    metrics.weeklyWeightChangePct,
    metrics.weeklyWeightChangeKg,
    metrics.waistChangeCm
  ];
  if (continuousValues.some((value) => !Number.isFinite(value))) {
    return true;
  }

  if (
    metrics.performancePercent !== null &&
    !Number.isFinite(metrics.performancePercent)
  ) {
    return true;
  }

  const subjectives = [
    metrics.averageSleep,
    metrics.averageReadiness,
    metrics.averageTrainingQuality
  ];
  if (
    subjectives.some(
      (value) =>
        value !== null &&
        (!Number.isFinite(value) || value < 1 || value > 10)
    )
  ) {
    return true;
  }

  const percentageIsNonZero =
    Math.abs(metrics.weeklyWeightChangePct) > WEIGHT_CHANGE_PCT_EPSILON;
  const kilogramsAreNonZero =
    Math.abs(metrics.weeklyWeightChangeKg) > WEIGHT_CHANGE_KG_EPSILON;

  return (
    percentageIsNonZero !== kilogramsAreNonZero ||
    (percentageIsNonZero &&
      kilogramsAreNonZero &&
      Math.sign(metrics.weeklyWeightChangePct) !==
        Math.sign(metrics.weeklyWeightChangeKg))
  );
}

function recommendationConfidence(metrics: RecommendationMetrics): Confidence {
  const subjectives = [
    metrics.averageSleep,
    metrics.averageReadiness,
    metrics.averageTrainingQuality
  ];

  return subjectives.some((value) => value !== null && value <= 4)
    ? "medium"
    : "high";
}

export function evaluateRecommendation(
  metrics: RecommendationMetrics
): RecommendationResult {
  if (hasInvalidMetrics(metrics)) {
    return result(
      "insufficient",
      "none",
      0,
      0,
      "low",
      ["INVALID_METRICS"],
      [INVALID_METRICS_MESSAGE]
    );
  }

  const reasonCodes: string[] = [];
  const missingData: string[] = [];

  if (metrics.validWeightsWeek1 < 5 || metrics.validWeightsWeek2 < 5) {
    missingData.push(WEIGHT_MESSAGE);
  }
  if (metrics.calorieDays < 10) {
    missingData.push(CALORIE_DAYS_MESSAGE);
  }
  if (metrics.waistDays < 4) {
    missingData.push(WAIST_DAYS_MESSAGE);
  }
  if (metrics.calorieMeanAbsoluteErrorPct > 10) {
    reasonCodes.push("LOW_CALORIE_ADHERENCE");
    missingData.push(CALORIE_ADHERENCE_MESSAGE);
  }
  if (missingData.length > 0) {
    return result(
      "insufficient",
      "none",
      0,
      0,
      "low",
      reasonCodes,
      missingData
    );
  }

  const confidence = recommendationConfidence(metrics);

  if (
    metrics.weeklyWeightChangePct > 0.5 &&
    metrics.waistChangeCm >= 0.5
  ) {
    return result(
      "pending",
      "decrease_all",
      -150,
      -150,
      confidence,
      ["FAST_WEIGHT_GAIN", "WAIST_GROWTH"]
    );
  }

  const hasRapidLoss =
    metrics.weeklyWeightChangePct < -0.5 ||
    metrics.weeklyWeightChangeKg <= -0.5;
  const hasPerformanceDecline =
    metrics.performancePercent !== null &&
    (metrics.performancePercent < 0 || metrics.repeatedExerciseDecline);

  if (hasRapidLoss && hasPerformanceDecline) {
    return result(
      "pending",
      "increase_all",
      100,
      100,
      confidence,
      ["FAST_WEIGHT_LOSS", "PERFORMANCE_DECLINE"]
    );
  }

  const hasStableWeight =
    metrics.weeklyWeightChangePct >= -0.2 &&
    metrics.weeklyWeightChangePct <= 0.2;
  if (hasStableWeight && metrics.waistChangeCm < 0.5) {
    if (metrics.performancePercent === null) {
      return result(
        "insufficient",
        "none",
        0,
        0,
        "low",
        ["MISSING_PERFORMANCE"],
        [MISSING_PERFORMANCE_MESSAGE]
      );
    }

    if (
      metrics.performancePercent >= 0 &&
      !metrics.repeatedExerciseDecline
    ) {
      return result(
        "pending",
        "increase_training",
        100,
        0,
        confidence,
        ["STABLE_WEIGHT", "STABLE_WAIST", "PERFORMANCE_OK"]
      );
    }
  }

  return result(
    "hold",
    "none",
    0,
    0,
    confidence,
    ["MONITOR_NEXT_BLOCK"]
  );
}
