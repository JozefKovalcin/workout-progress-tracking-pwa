import { subDays } from "date-fns";
import { fromLocalDate } from "./date";
import { workoutE1Rm } from "./performance";
import type { DailyEntry, LocalDate, TopSet } from "./types";

export type ProgressRange = 7 | 30 | 90 | "all";
export type DailyMetric = "weightKg" | "waistCm" | "calories";

export interface ProgressPoint {
  date: LocalDate;
  value: number;
}

function inRange(date: LocalDate, endDate: LocalDate, range: ProgressRange) {
  const value = fromLocalDate(date);
  const end = fromLocalDate(endDate);
  if (value > end) return false;
  return range === "all" || value >= subDays(end, range - 1);
}

export function buildDailySeries(
  entries: DailyEntry[],
  metric: DailyMetric,
  endDate: LocalDate,
  range: ProgressRange
): ProgressPoint[] {
  return entries
    .filter((entry) => inRange(entry.date, endDate, range))
    .flatMap((entry) => {
      const value = entry[metric];
      return Number.isFinite(value)
        ? [{ date: entry.date, value: value as number }]
        : [];
    })
    .sort((left, right) => left.date.localeCompare(right.date));
}

export function buildStrengthSeries(
  sets: TopSet[],
  exerciseId: string,
  endDate: LocalDate,
  range: ProgressRange
): ProgressPoint[] {
  return sets
    .filter((set) =>
      set.exerciseId === exerciseId &&
      inRange(set.date, endDate, range)
    )
    .map((set) => ({ date: set.date, value: workoutE1Rm(set) }))
    .sort((left, right) => left.date.localeCompare(right.date));
}
