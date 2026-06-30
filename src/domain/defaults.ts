import type { Exercise, TrackerProfile, TrainingDayPlan } from "./types";

export const CALIBRATION_PROFILE: TrackerProfile = {
  startDate: "2026-06-19",
  startingWeightKg: 81.4,
  trainingCalories: 2900,
  restCalories: 2700,
  proteinGrams: 180,
  fatGrams: 50,
  evaluationDays: 14,
  targetGainMinPct: 0.2,
  targetGainMaxPct: 0.35
};

const mainExerciseRows: Array<[string, string, string, number, number]> = [
  ["incline-db-press", "Incline DB press", "Hrudník", 6, 10],
  ["machine-chest-press", "Machine chest press", "Hrudník", 8, 12],
  ["flat-bench-press", "Flat Bench Press", "Hrudník", 6, 10],
  ["chest-supported-row", "Chest-supported row", "Chrbát", 8, 12],
  ["lat-pulldown", "Lat pulldown", "Chrbát", 8, 12],
  ["chin-row", "Chin row", "Ramená", 10, 15],
  ["cable-lateral-raise", "Cable lateral raise", "Ramená", 8, 15],
  ["hack-squat-leg-press", "Hack squat / leg press", "Quads", 6, 10],
  ["seated-lying-leg-curl", "Seated/lying leg curl", "Hamstringy", 8, 15],
  ["rdl", "RDL", "Hamstringy", 6, 10],
  ["hip-thrust", "Hip thrust", "Glutes", 8, 12],
  ["walking-lunge", "Walking lunge", "Glutes", 10, 15],
  ["standing-calf-raise", "Standing calf raise", "Lýtka", 8, 15],
  ["cable-crunch", "Cable crunch", "Brucho", 10, 20],
  ["dragon-flag", "Dragon Flag", "Brucho", 8, 15]
];

export const DEFAULT_EXERCISES: Exercise[] = mainExerciseRows.map(
  ([id, name, muscleGroup, repMin, repMax]) => ({
    id,
    name,
    muscleGroup,
    repMin,
    repMax,
    isMain: true
  })
);

export const DEFAULT_TRAINING_DAYS: TrainingDayPlan[] = [
  {
    weekday: 1,
    label: "Lower / quads",
    enabled: true,
    categoryNames: [],
    exerciseIds: [
      "hack-squat-leg-press",
      "seated-lying-leg-curl",
      "standing-calf-raise",
      "cable-crunch"
    ]
  },
  { weekday: 2, label: "Voľno", enabled: false, exerciseIds: [], categoryNames: [] },
  {
    weekday: 3,
    label: "Hrudník priority / pull",
    enabled: true,
    categoryNames: [],
    exerciseIds: ["incline-db-press", "chest-supported-row"]
  },
  { weekday: 4, label: "Voľno", enabled: false, exerciseIds: [], categoryNames: [] },
  {
    weekday: 5,
    label: "Pump / objem",
    enabled: true,
    categoryNames: [],
    exerciseIds: ["machine-chest-press", "cable-lateral-raise", "chin-row"]
  },
  {
    weekday: 6,
    label: "Posterior / pull",
    enabled: true,
    categoryNames: [],
    exerciseIds: ["rdl", "hip-thrust", "walking-lunge", "lat-pulldown"]
  },
  {
    weekday: 7,
    label: "Hrudník weakpoint / brucho",
    enabled: true,
    categoryNames: [],
    exerciseIds: ["flat-bench-press", "dragon-flag"]
  }
];
