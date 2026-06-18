import { weekdayIso } from "./date";
import type { DayType, LocalDate, MacroTargets, TrainingDayPlan } from "./types";

export function calculateMacros(
  calories: number,
  proteinGrams: number,
  fatGrams: number
): MacroTargets {
  return {
    calories,
    proteinGrams,
    carbsGrams: (calories - proteinGrams * 4 - fatGrams * 9) / 4,
    fatGrams
  };
}

export function resolveDayType(
  date: LocalDate,
  plan: TrainingDayPlan[],
  override?: DayType
): DayType {
  if (override) {
    return override;
  }

  return plan.find((day) => day.weekday === weekdayIso(date))?.enabled ? "training" : "rest";
}
