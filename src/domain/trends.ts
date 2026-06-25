export type TrendTone = "positive" | "negative" | "neutral" | "warning";

export interface TrendClassification {
  tone: TrendTone;
  className: string;
  badge: "zlepšenie" | "pokles" | "bez zmeny" | "málo dát";
}

export interface WeightTrendInput {
  weeklyChangePct: number;
  targetGainMinPct: number;
  targetGainMaxPct: number;
}

export const CALORIE_ADHERENCE_GOOD_MAX_PCT = 10;
export const FAST_WEIGHT_GAIN_WEEKLY_PCT = 0.5;
export const FAST_WEIGHT_LOSS_WEEKLY_PCT = -0.5;
export const WAIST_WARNING_CHANGE_CM = 0.1;
export const WAIST_DANGER_CHANGE_CM = 0.5;

const positive = (): TrendClassification => ({
  tone: "positive",
  className: "trend-positive",
  badge: "zlepšenie"
});

const negative = (className = "trend-negative"): TrendClassification => ({
  tone: "negative",
  className,
  badge: "pokles"
});

const warning = (): TrendClassification => ({
  tone: "warning",
  className: "status-warning",
  badge: "pokles"
});

const neutral = (badge: TrendClassification["badge"] = "bez zmeny"): TrendClassification => ({
  tone: "neutral",
  className: "trend-neutral",
  badge
});

function finite(value: number): boolean {
  return Number.isFinite(value);
}

export function classifyStrengthTrend(change: number): TrendClassification {
  if (!finite(change)) return neutral("málo dát");
  if (change > 0) return positive();
  if (change < 0) return negative();
  return neutral();
}

export function classifyWeightTrend({
  weeklyChangePct,
  targetGainMinPct,
  targetGainMaxPct
}: WeightTrendInput): TrendClassification {
  if (
    !finite(weeklyChangePct) ||
    !finite(targetGainMinPct) ||
    !finite(targetGainMaxPct)
  ) {
    return neutral("málo dát");
  }

  if (weeklyChangePct < 0) return negative();
  if (
    weeklyChangePct >= targetGainMinPct &&
    weeklyChangePct <= targetGainMaxPct
  ) {
    return positive();
  }
  if (weeklyChangePct > FAST_WEIGHT_GAIN_WEEKLY_PCT) return negative();
  if (weeklyChangePct > targetGainMaxPct) return warning();
  return neutral();
}

export function classifyWaistTrend(changeCm: number): TrendClassification {
  if (!finite(changeCm)) return neutral("málo dát");
  if (changeCm >= WAIST_DANGER_CHANGE_CM) return negative();
  if (changeCm >= WAIST_WARNING_CHANGE_CM) return warning();
  if (changeCm < 0) return positive();
  return neutral();
}

export function classifyCalorieAdherence(adherencePct: number | null): TrendClassification {
  if (adherencePct === null || !finite(adherencePct)) return neutral("málo dát");
  return adherencePct <= CALORIE_ADHERENCE_GOOD_MAX_PCT
    ? { ...positive(), className: "status-good" }
    : negative("status-danger");
}

export function classifyCalorieAdherenceTrend(
  currentAdherencePct: number | null,
  previousAdherencePct: number | null
): TrendClassification {
  if (
    currentAdherencePct === null ||
    previousAdherencePct === null ||
    !finite(currentAdherencePct) ||
    !finite(previousAdherencePct)
  ) {
    return neutral("málo dát");
  }

  if (currentAdherencePct < previousAdherencePct) return positive();
  if (currentAdherencePct > previousAdherencePct) return negative();
  return neutral();
}
