import { subDays } from "date-fns";
import { calculateMacros, resolveDayType } from "../domain/macros";
import type {
  DayType,
  LocalDate,
  MacroTargets,
  TargetPeriod
} from "../domain/types";
import type { TrackerSnapshot } from "../data/trackerData";
import { fromLocalDate, toLocalDate } from "../domain/date";
import type { Screen } from "./appTypes";

export const MODE_KEY = "lean-bulk-tracker-mode";

export const EMPTY_SNAPSHOT: TrackerSnapshot = {
  profile: null,
  dailyEntries: [],
  exercises: [],
  trainingDays: [],
  topSets: [],
  targets: [],
  recommendations: []
};

export const nav: Array<[Screen, string]> = [
  ["today", "Dnes"],
  ["training", "Tréning"],
  ["progress", "Progress"],
  ["settings", "Nastavenia"]
];

export const reasonLabels: Record<string, string> = {
  FAST_WEIGHT_GAIN: "Hmotnosť rastie príliš rýchlo",
  WAIST_GROWTH: "Pás rastie",
  FAST_WEIGHT_LOSS: "Hmotnosť klesá",
  PERFORMANCE_DECLINE: "Výkon klesá",
  STABLE_WEIGHT: "Hmotnosť je stabilná",
  STABLE_WAIST: "Pás je stabilný",
  PERFORMANCE_OK: "Výkon je stabilný",
  MONITOR_NEXT_BLOCK: "Pokračuj bez zmeny"
};

export const numberOrUndefined = (value: FormDataEntryValue | null) => {
  if (value === null || String(value).trim() === "") return undefined;
  return Number(value);
};

export const requiredNumber = (value: FormDataEntryValue | null) =>
  numberOrUndefined(value) ?? Number.NaN;

export const average = (values: Array<number | undefined>) => {
  const valid = values.filter((value): value is number => Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
};

export const fmt = (value: number | null, suffix = "") =>
  value === null || !Number.isFinite(value) ? "—" : `${value.toFixed(1)}${suffix}`;

export const trend = (values: Array<number | undefined>, suffix: string) => {
  const valid = values.filter((value): value is number => Number.isFinite(value));
  if (valid.length < 2) return "zbieraj merania";
  const change = valid.at(-1)! - valid[0];
  return `trend ${change >= 0 ? "+" : ""}${change.toFixed(1)} ${suffix}`;
};

export function targetsForDate(
  targets: TargetPeriod[],
  date: LocalDate,
  dayType: DayType
): MacroTargets {
  const period = [...targets]
    .filter((item) => item.effectiveDate <= date)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0];
  return period?.[dayType] ?? calculateMacros(dayType === "training" ? 2900 : 2700, 180, 50);
}

export function recentDates(end: LocalDate, count: number) {
  return Array.from({ length: count }, (_, index) => toLocalDate(subDays(fromLocalDate(end), index)));
}

export function currentTargetPeriod(targets: TargetPeriod[], today: LocalDate) {
  return [...targets]
    .filter((period) => period.effectiveDate <= today)
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0];
}

export function targetForEntry(
  snapshot: TrackerSnapshot,
  date: LocalDate,
  dayTypeOverride?: DayType
) {
  return targetsForDate(
    snapshot.targets,
    date,
    resolveDayType(date, snapshot.trainingDays, dayTypeOverride)
  );
}

