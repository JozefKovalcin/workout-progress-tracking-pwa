import { subDays } from "date-fns";
import { fromLocalDate } from "./date";
import type { LocalDate, TopSet } from "./types";

export interface ExercisePerformance {
  exerciseId: string;
  current: TopSet;
  previous: TopSet;
  percentChange: number;
  isPr: boolean;
  reliability: "normal" | "low";
}

export interface PerformanceSummary {
  overallPercent: number | null;
  comparableExercises: number;
  items: ExercisePerformance[];
  repeatedDeclineExerciseIds: string[];
}

export function calculateE1Rm(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30);
}

export function workoutE1Rm(set: TopSet): number {
  const values = set.sets?.map((item) => item.estimated1RmKg);
  return values?.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : set.estimated1RmKg;
}

function workoutRir(set: TopSet): number {
  const values = set.sets?.map((item) => item.rir);
  return values?.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : set.rir;
}

function percentChange(current: TopSet, previous: TopSet): number {
  return (
    ((workoutE1Rm(current) - workoutE1Rm(previous)) /
      workoutE1Rm(previous)) *
    100
  );
}

export function summarizePerformance(
  sets: TopSet[],
  endDate: LocalDate
): PerformanceSummary {
  const end = fromLocalDate(endDate);
  const windowStart = subDays(end, 6);
  const sortedSets = [...sets]
    .map((set) => ({ set, date: fromLocalDate(set.date) }))
    .filter(({ date }) => date <= end)
    .sort(
      (left, right) =>
        left.date.getTime() - right.date.getTime() ||
        left.set.updatedAtMs - right.set.updatedAtMs ||
        left.set.id.localeCompare(right.set.id)
    );
  const setsByExercise = new Map<string, typeof sortedSets>();

  for (const entry of sortedSets) {
    const exerciseSets = setsByExercise.get(entry.set.exerciseId) ?? [];
    exerciseSets.push(entry);
    setsByExercise.set(entry.set.exerciseId, exerciseSets);
  }

  const items: ExercisePerformance[] = [];
  const repeatedDeclineExerciseIds: string[] = [];

  for (const [exerciseId, exerciseSets] of setsByExercise) {
    const currentEntry = exerciseSets.findLast(
      ({ date }) => date >= windowStart && date <= end
    );
    if (!currentEntry) {
      continue;
    }

    const previousIndex = exerciseSets.findLastIndex(
      ({ date }) => date < currentEntry.date
    );
    if (previousIndex < 0) {
      continue;
    }

    const previousEntry = exerciseSets[previousIndex];
    const historicalMax = Math.max(
      ...exerciseSets
        .slice(0, previousIndex + 1)
        .filter(({ date }) => date < currentEntry.date)
        .map(({ set }) => workoutE1Rm(set))
    );
    const currentE1Rm = workoutE1Rm(currentEntry.set);
    const currentChange = percentChange(currentEntry.set, previousEntry.set);

    items.push({
      exerciseId,
      current: currentEntry.set,
      previous: previousEntry.set,
      percentChange: currentChange,
      isPr: ((currentE1Rm - historicalMax) / historicalMax) * 100 > 0.5,
      reliability:
        Math.abs(workoutRir(currentEntry.set) - workoutRir(previousEntry.set)) > 1.5
          ? "low"
          : "normal"
    });

    const beforePreviousEntry = exerciseSets
      .slice(0, previousIndex)
      .findLast(({ date }) => date < previousEntry.date);
    if (
      beforePreviousEntry &&
      percentChange(previousEntry.set, beforePreviousEntry.set) < -1 &&
      currentChange < -1
    ) {
      repeatedDeclineExerciseIds.push(exerciseId);
    }
  }

  items.sort((left, right) => left.exerciseId.localeCompare(right.exerciseId));
  repeatedDeclineExerciseIds.sort((left, right) => left.localeCompare(right));

  return {
    overallPercent:
      items.length === 0
        ? null
        : items.reduce((sum, item) => sum + item.percentChange, 0) / items.length,
    comparableExercises: items.length,
    items,
    repeatedDeclineExerciseIds
  };
}
