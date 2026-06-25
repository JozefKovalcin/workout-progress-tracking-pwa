import { addDays, differenceInCalendarDays } from "date-fns";
import { fromLocalDate, toLocalDate } from "../domain/date";
import { resolveDayType } from "../domain/macros";
import { workoutE1Rm } from "../domain/performance";
import type { LocalDate, TopSet } from "../domain/types";
import type { ProgressPoint } from "../domain/progress";
import type { TrackerSnapshot } from "../data/trackerData";
import { deriveBlock } from "./recommendationFlow";

export interface BlockCompleteness {
  blockStart: LocalDate;
  blockEnd: LocalDate;
  day: number;
  completed: number;
  total: number;
  missing: {
    weight: LocalDate[];
    waist: LocalDate[];
    calories: LocalDate[];
    trainingQuality: LocalDate[];
  };
}

export type FeedbackTone = "positive" | "neutral" | "negative";

export interface TrainingFeedback {
  tone: FeedbackTone;
  label: string;
  detail: string;
  percentChange: number | null;
  deltaKg: number | null;
  isPr: boolean;
}

export interface PreviousBestTopSet {
  label: "Najlepší záznam" | "Druhý najlepší záznam";
  set: TopSet;
  e1RmKg: number;
}

function finite(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value);
}

function datesBetween(start: LocalDate, end: LocalDate) {
  const startDate = fromLocalDate(start);
  const days = differenceInCalendarDays(fromLocalDate(end), startDate) + 1;
  return Array.from({ length: Math.max(0, days) }, (_, index) =>
    toLocalDate(addDays(startDate, index))
  );
}

export function buildBlockCompleteness(
  snapshot: TrackerSnapshot,
  today: LocalDate
): BlockCompleteness {
  const profile = snapshot.profile;
  if (!profile) {
    return {
      blockStart: today,
      blockEnd: today,
      day: 1,
      completed: 0,
      total: 0,
      missing: { weight: [], waist: [], calories: [], trainingQuality: [] }
    };
  }

  const block = deriveBlock(profile, snapshot.targets, snapshot.recommendations, today);
  const visibleEnd = today < block.blockEnd ? today : block.blockEnd;
  const entriesByDate = new Map(
    snapshot.dailyEntries
      .filter((entry) => entry.date >= block.blockStart && entry.date <= visibleEnd)
      .sort((a, b) => a.updatedAtMs - b.updatedAtMs)
      .map((entry) => [entry.date, entry])
  );
  const missing: BlockCompleteness["missing"] = {
    weight: [],
    waist: [],
    calories: [],
    trainingQuality: []
  };
  let completed = 0;
  let total = 0;

  for (const date of datesBetween(block.blockStart, visibleEnd)) {
    const entry = entriesByDate.get(date);
    const dayType = resolveDayType(date, snapshot.trainingDays, entry?.dayTypeOverride);

    total += 1;
    if (finite(entry?.weightKg)) completed += 1;
    else missing.weight.push(date);

    total += 1;
    if (finite(entry?.waistCm)) completed += 1;
    else missing.waist.push(date);

    total += 1;
    if (finite(entry?.calories)) completed += 1;
    else missing.calories.push(date);

    if (dayType === "training") {
      total += 1;
      if (finite(entry?.trainingQualityScore)) completed += 1;
      else missing.trainingQuality.push(date);
    }
  }

  return {
    blockStart: block.blockStart,
    blockEnd: block.blockEnd,
    day: block.day,
    completed,
    total,
    missing
  };
}

export function buildMovingAverageSeries(
  points: ProgressPoint[],
  windowSize: number
): ProgressPoint[] {
  return points.map((point, index) => {
    const window = points.slice(Math.max(0, index - windowSize + 1), index + 1);
    return {
      date: point.date,
      value: window.reduce((sum, item) => sum + item.value, 0) / window.length
    };
  });
}

export function summarizeTrend(points: ProgressPoint[], unit: string) {
  if (points.length < 2) return "zbieraj merania";
  const change = points.at(-1)!.value - points[0].value;
  return `${change >= 0 ? "+" : ""}${change.toFixed(1)} ${unit}`;
}

export function previousBestTopSets(
  sets: TopSet[],
  exerciseId: string,
  beforeDate: LocalDate
): PreviousBestTopSet[] {
  const labels: Array<PreviousBestTopSet["label"]> = [
    "Najlepší záznam",
    "Druhý najlepší záznam"
  ];

  return [...sets]
    .filter((set) => set.exerciseId === exerciseId && set.date < beforeDate)
    .sort((left, right) => {
      const e1RmDiff = workoutE1Rm(right) - workoutE1Rm(left);
      if (e1RmDiff !== 0) return e1RmDiff;
      const dateDiff = right.date.localeCompare(left.date);
      if (dateDiff !== 0) return dateDiff;
      const updatedDiff = right.updatedAtMs - left.updatedAtMs;
      return updatedDiff !== 0 ? updatedDiff : right.id.localeCompare(left.id);
    })
    .slice(0, 2)
    .map((set, index) => ({
      label: labels[index],
      set,
      e1RmKg: workoutE1Rm(set)
    }));
}

export function describeTrainingFeedback(
  averageE1Rm: number | null,
  previous: TopSet | undefined
): TrainingFeedback {
  if (averageE1Rm === null || !previous) {
    return {
      tone: "neutral",
      label: "Zbieraj dáta",
      detail: "Porovnanie sa zobrazí po ďalšom top sete.",
      percentChange: null,
      deltaKg: null,
      isPr: false
    };
  }

  const previousAverage = workoutE1Rm(previous);
  const deltaKg = averageE1Rm - previousAverage;
  const percentChange = ((averageE1Rm - previousAverage) / previousAverage) * 100;
  const isPr = percentChange > 0.5;
  if (percentChange >= 1) {
    return {
      tone: "positive",
      label: isPr ? "Nový PR" : "Výkon hore",
      detail: `+${deltaKg.toFixed(1)} kg / +${percentChange.toFixed(1)} % oproti najlepšiemu záznamu`,
      percentChange,
      deltaKg,
      isPr
    };
  }
  if (percentChange <= -1) {
    return {
      tone: "negative",
      label: "Výkon dole",
      detail: `${deltaKg.toFixed(1)} kg / ${percentChange.toFixed(1)} % oproti najlepšiemu záznamu`,
      percentChange,
      deltaKg,
      isPr
    };
  }

  return {
    tone: "neutral",
    label: "Stabilné",
    detail: `${deltaKg >= 0 ? "+" : ""}${deltaKg.toFixed(1)} kg / ${percentChange >= 0 ? "+" : ""}${percentChange.toFixed(1)} % oproti najlepšiemu záznamu`,
    percentChange,
    deltaKg,
    isPr
  };
}
