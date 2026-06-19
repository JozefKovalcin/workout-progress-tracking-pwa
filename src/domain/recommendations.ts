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
  "Povinné metriky musia byť konečné číselné hodnoty.";
const MISSING_PERFORMANCE_MESSAGE =
  "Na zvýšenie kalórií je potrebný aspoň jeden porovnateľný hlavný cvik.";

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
  const values = [
    metrics.validWeightsWeek1,
    metrics.validWeightsWeek2,
    metrics.calorieDays,
    metrics.waistDays,
    metrics.calorieMeanAbsoluteErrorPct,
    metrics.weeklyWeightChangePct,
    metrics.weeklyWeightChangeKg,
    metrics.waistChangeCm,
    metrics.performancePercent,
    metrics.averageSleep,
    metrics.averageReadiness,
    metrics.averageTrainingQuality
  ];

  return values.some((value) => value !== null && !Number.isFinite(value));
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
  if (hasInvalidMetrics(metrics)) {
    reasonCodes.push("INVALID_METRICS");
    missingData.push(INVALID_METRICS_MESSAGE);
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
