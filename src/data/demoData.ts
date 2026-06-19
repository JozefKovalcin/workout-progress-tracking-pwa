import { calculateMacros } from "../domain/macros";
import { CALIBRATION_PROFILE, DEFAULT_EXERCISES, DEFAULT_TRAINING_DAYS } from "../domain/defaults";
import type {
  DailyEntry,
  Exercise,
  TargetPeriod,
  TopSet,
  TrainingDayPlan
} from "../domain/types";
import { syncStore } from "./syncStore";
import type {
  StoredRecommendation,
  TrackerDataSource,
  TrackerSnapshot
} from "./trackerData";

export const DEMO_STORAGE_KEY = "lean-bulk-tracker-demo-v1";

type DemoState = TrackerSnapshot;

const seedState = (): DemoState => ({
  profile: { ...CALIBRATION_PROFILE },
  dailyEntries: [],
  exercises: DEFAULT_EXERCISES.map((row) => ({ ...row })),
  trainingDays: DEFAULT_TRAINING_DAYS.map((row) => ({ ...row, exerciseIds: [...row.exerciseIds] })),
  topSets: [],
  targets: [{
    id: CALIBRATION_PROFILE.startDate,
    effectiveDate: CALIBRATION_PROFILE.startDate,
    training: calculateMacros(CALIBRATION_PROFILE.trainingCalories, CALIBRATION_PROFILE.proteinGrams, CALIBRATION_PROFILE.fatGrams),
    rest: calculateMacros(CALIBRATION_PROFILE.restCalories, CALIBRATION_PROFILE.proteinGrams, CALIBRATION_PROFILE.fatGrams),
    reason: "Počiatočná kalibrácia",
    createdAtMs: Date.now()
  }],
  recommendations: []
});

export function createDemoTrackerData(storage: Storage): TrackerDataSource {
  const listeners = new Set<(value: TrackerSnapshot) => void>();
  const read = (): DemoState => {
    try {
      const raw = storage.getItem(DEMO_STORAGE_KEY);
      return raw ? JSON.parse(raw) as DemoState : seedState();
    } catch {
      return seedState();
    }
  };
  const write = (value: DemoState) => {
    storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(value));
    syncStore.markLocal();
    listeners.forEach((listener) => listener(structuredClone(value)));
    queueMicrotask(syncStore.markSynced);
  };
  const upsert = <T, K extends keyof T>(rows: T[], value: T, key: K) => {
    const index = rows.findIndex((row) => row[key] === value[key]);
    if (index >= 0) rows[index] = value;
    else rows.push(value);
  };

  return {
    async seedIfNeeded() {
      if (!storage.getItem(DEMO_STORAGE_KEY)) write(seedState());
    },
    subscribeTracker(_uid, cb) {
      listeners.add(cb);
      cb(structuredClone(read()));
      return () => listeners.delete(cb);
    },
    async saveDailyEntry(_uid, value: DailyEntry) {
      const state = read();
      upsert(state.dailyEntries, value, "date");
      write(state);
    },
    async saveTopSet(_uid, value: TopSet) {
      const state = read();
      upsert(state.topSets, value, "id");
      write(state);
    },
    async saveExercise(_uid, value: Exercise) {
      const state = read();
      upsert(state.exercises, value, "id");
      write(state);
    },
    async saveTrainingDay(_uid, value: TrainingDayPlan) {
      const state = read();
      upsert(state.trainingDays, value, "weekday");
      write(state);
    },
    async decideRecommendation(_uid, value: StoredRecommendation, nextTargets?: TargetPeriod) {
      const state = read();
      upsert(state.recommendations, value, "id");
      if (nextTargets) upsert(state.targets, nextTargets, "id");
      write(state);
    },
    async exportAll() {
      return structuredClone(read()) as unknown as Record<string, unknown>;
    },
    reset() {
      storage.removeItem(DEMO_STORAGE_KEY);
      write(seedState());
    }
  };
}
