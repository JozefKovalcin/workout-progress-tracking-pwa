export type LocalDate = `${number}-${number}-${number}`;
export type DayType = "training" | "rest";
export type RecommendationStatus = "pending" | "accepted" | "rejected" | "insufficient" | "hold";
export type Confidence = "low" | "medium" | "high";

export interface TrackerProfile {
  startDate: LocalDate;
  startingWeightKg: number;
  trainingCalories: number;
  restCalories: number;
  proteinGrams: number;
  fatGrams: number;
  evaluationDays: 14;
  targetGainMinPct: number;
  targetGainMaxPct: number;
}

export interface DailyEntry {
  date: LocalDate;
  dayTypeOverride?: DayType;
  weightKg?: number;
  waistCm?: number;
  calories?: number;
  sleepScore?: number;
  readinessScore?: number;
  trainingQualityScore?: number;
  updatedAtMs: number;
}

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  repMin: number;
  repMax: number;
  isMain: boolean;
  archivedAtMs?: number;
}

export interface TrainingDayPlan {
  weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  label: string;
  enabled: boolean;
  exerciseIds: string[];
  categoryNames?: string[];
}

export interface WorkingSet {
  weightKg: number;
  reps: number;
  rir: number;
  estimated1RmKg: number;
}

export interface TopSet {
  id: string;
  date: LocalDate;
  exerciseId: string;
  weightKg: number;
  reps: number;
  rir: number;
  note?: string;
  estimated1RmKg: number;
  sets?: WorkingSet[];
  updatedAtMs: number;
}

export interface MacroTargets {
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
}

export interface TargetPeriod {
  id: string;
  effectiveDate: LocalDate;
  training: MacroTargets;
  rest: MacroTargets;
  reason: string;
  createdAtMs: number;
}
