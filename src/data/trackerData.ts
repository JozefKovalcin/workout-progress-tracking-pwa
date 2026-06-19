import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  waitForPendingWrites,
  writeBatch,
  type DocumentData,
  type Unsubscribe
} from "firebase/firestore";
import { calculateMacros } from "../domain/macros";
import { isLocalDate } from "../domain/date";
import { CALIBRATION_PROFILE, DEFAULT_EXERCISES, DEFAULT_TRAINING_DAYS } from "../domain/defaults";
import type {
  DailyEntry,
  Exercise,
  LocalDate,
  TargetPeriod,
  TopSet,
  TrackerProfile,
  TrainingDayPlan
} from "../domain/types";
import type {
  RecommendationMetrics,
  RecommendationResult
} from "../domain/recommendations";
import { db } from "./firebase";
import {
  signInWithGoogle,
  signOutCurrentUser,
  subscribeUser
} from "./firebaseAuth";
import { syncStore } from "./syncStore";

export interface StoredRecommendation extends RecommendationResult {
  id: string;
  windowStart: LocalDate;
  windowEnd: LocalDate;
  metrics: RecommendationMetrics;
  decidedAtMs?: number;
}

export interface TrackerSnapshot {
  profile: TrackerProfile | null;
  dailyEntries: DailyEntry[];
  exercises: Exercise[];
  trainingDays: TrainingDayPlan[];
  topSets: TopSet[];
  targets: TargetPeriod[];
  recommendations: StoredRecommendation[];
}

export interface TrackerDataSource {
  seedIfNeeded(uid: string): Promise<void>;
  subscribeTracker(uid: string, cb: (value: TrackerSnapshot) => void): Unsubscribe;
  saveDailyEntry(uid: string, value: DailyEntry): Promise<void>;
  saveTopSet(uid: string, value: TopSet): Promise<void>;
  saveExercise(uid: string, value: Exercise): Promise<void>;
  saveTrainingDay(uid: string, value: TrainingDayPlan): Promise<void>;
  decideRecommendation(
    uid: string,
    value: StoredRecommendation,
    nextTargets?: TargetPeriod
  ): Promise<void>;
  exportAll(uid: string): Promise<Record<string, unknown>>;
  reset?(): void;
}

const emptySnapshot = (): TrackerSnapshot => ({
  profile: null,
  dailyEntries: [],
  exercises: [],
  trainingDays: [],
  topSets: [],
  targets: [],
  recommendations: []
});

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const text = (value: unknown): value is string => typeof value === "string";
const stampMs = (value: DocumentData, key: string) =>
  finite(value[key]) ? value[key] : value.updatedAt?.toMillis?.() ?? value.createdAt?.toMillis?.() ?? Date.now();

function mapProfile(value: DocumentData): TrackerProfile | null {
  return isLocalDate(value.startDate) &&
    finite(value.startingWeightKg) &&
    finite(value.trainingCalories) &&
    finite(value.restCalories) &&
    finite(value.proteinGrams) &&
    finite(value.fatGrams) &&
    value.evaluationDays === 14 &&
    finite(value.targetGainMinPct) &&
    finite(value.targetGainMaxPct)
    ? value as TrackerProfile
    : null;
}

function mapDaily(value: DocumentData): DailyEntry | null {
  if (!isLocalDate(value.date)) return null;
  const numeric = ["weightKg", "waistCm", "calories", "sleepScore", "readinessScore", "trainingQualityScore"];
  if (numeric.some((key) => value[key] !== undefined && !finite(value[key]))) return null;
  if (value.dayTypeOverride !== undefined && value.dayTypeOverride !== "training" && value.dayTypeOverride !== "rest") return null;
  return { ...value, updatedAtMs: stampMs(value, "updatedAtMs") } as DailyEntry;
}

function mapExercise(value: DocumentData, id: string): Exercise | null {
  return text(value.name) &&
    text(value.muscleGroup) &&
    finite(value.repMin) &&
    finite(value.repMax) &&
    typeof value.isMain === "boolean" &&
    (value.archivedAtMs === undefined || finite(value.archivedAtMs))
    ? { ...value, id } as Exercise
    : null;
}

function mapDay(value: DocumentData): TrainingDayPlan | null {
  return Number.isInteger(value.weekday) &&
    value.weekday >= 1 &&
    value.weekday <= 7 &&
    text(value.label) &&
    typeof value.enabled === "boolean" &&
    Array.isArray(value.exerciseIds) &&
    value.exerciseIds.every(text)
    ? value as TrainingDayPlan
    : null;
}

function mapTopSet(value: DocumentData, id: string): TopSet | null {
  return isLocalDate(value.date) &&
    text(value.exerciseId) &&
    finite(value.weightKg) &&
    finite(value.reps) &&
    finite(value.rir) &&
    finite(value.estimated1RmKg)
    ? { ...value, id, updatedAtMs: stampMs(value, "updatedAtMs") } as TopSet
    : null;
}

function mapTarget(value: DocumentData, id: string): TargetPeriod | null {
  const macro = (row: unknown) => {
    const item = row as DocumentData;
    return item && finite(item.calories) && finite(item.proteinGrams) && finite(item.carbsGrams) && finite(item.fatGrams);
  };
  return isLocalDate(value.effectiveDate) && macro(value.training) && macro(value.rest) && text(value.reason)
    ? { ...value, id, createdAtMs: stampMs(value, "createdAtMs") } as TargetPeriod
    : null;
}

function mapRecommendation(value: DocumentData, id: string): StoredRecommendation | null {
  const metrics = value.metrics as DocumentData | undefined;
  const metricNumbers = [
    "validWeightsWeek1", "validWeightsWeek2", "calorieDays", "waistDays",
    "calorieMeanAbsoluteErrorPct", "weeklyWeightChangePct", "weeklyWeightChangeKg",
    "waistChangeCm"
  ];
  const optionalMetrics = ["performancePercent", "averageSleep", "averageReadiness", "averageTrainingQuality"];
  return isLocalDate(value.windowStart) &&
    isLocalDate(value.windowEnd) &&
    ["pending", "accepted", "rejected", "insufficient", "hold"].includes(value.status) &&
    text(value.action) &&
    finite(value.calorieDeltaTraining) &&
    finite(value.calorieDeltaRest) &&
    ["low", "medium", "high"].includes(value.confidence) &&
    Array.isArray(value.reasonCodes) &&
    Array.isArray(value.missingData) &&
    metrics &&
    metricNumbers.every((key) => finite(metrics[key])) &&
    optionalMetrics.every((key) => metrics[key] === null || finite(metrics[key])) &&
    typeof metrics.repeatedExerciseDecline === "boolean"
    ? { ...value, id } as StoredRecommendation
    : null;
}

function path(uid: string, name: string) {
  return collection(db, "users", uid, name);
}

async function queued(write: Promise<unknown>) {
  await write;
  syncStore.markLocal();
  void waitForPendingWrites(db).then(syncStore.markSynced, syncStore.markError);
}

export { signInWithGoogle, signOutCurrentUser, subscribeUser };

export async function seedIfNeeded(uid: string) {
  const profileRef = doc(db, "users", uid, "profile", "main");
  if ((await getDoc(profileRef)).exists()) return;
  const batch = writeBatch(db);
  const target = {
    id: CALIBRATION_PROFILE.startDate,
    effectiveDate: CALIBRATION_PROFILE.startDate,
    training: calculateMacros(
      CALIBRATION_PROFILE.trainingCalories,
      CALIBRATION_PROFILE.proteinGrams,
      CALIBRATION_PROFILE.fatGrams
    ),
    rest: calculateMacros(
      CALIBRATION_PROFILE.restCalories,
      CALIBRATION_PROFILE.proteinGrams,
      CALIBRATION_PROFILE.fatGrams
    ),
    reason: "Počiatočná kalibrácia",
    createdAtMs: Date.now()
  } satisfies TargetPeriod;
  batch.set(profileRef, { ...CALIBRATION_PROFILE, updatedAt: serverTimestamp() });
  batch.set(doc(path(uid, "targetHistory"), target.id), { ...target, createdAt: serverTimestamp() });
  DEFAULT_EXERCISES.forEach((exercise) =>
    batch.set(doc(path(uid, "exercises"), exercise.id), { ...exercise, updatedAt: serverTimestamp() })
  );
  DEFAULT_TRAINING_DAYS.forEach((day) =>
    batch.set(doc(path(uid, "trainingDays"), String(day.weekday)), { ...day, updatedAt: serverTimestamp() })
  );
  await queued(batch.commit());
}

export function subscribeTracker(uid: string, cb: (value: TrackerSnapshot) => void) {
  const value = emptySnapshot();
  const emit = () => cb({
    ...value,
    dailyEntries: [...value.dailyEntries].sort((a, b) => a.date.localeCompare(b.date)),
    exercises: [...value.exercises].sort((a, b) => a.name.localeCompare(b.name)),
    trainingDays: [...value.trainingDays].sort((a, b) => a.weekday - b.weekday),
    topSets: [...value.topSets].sort((a, b) => a.date.localeCompare(b.date)),
    targets: [...value.targets].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate)),
    recommendations: [...value.recommendations].sort((a, b) => a.windowEnd.localeCompare(b.windowEnd))
  });
  const unsubs = [
    onSnapshot(doc(db, "users", uid, "profile", "main"), (snap) => {
      value.profile = snap.exists() ? mapProfile(snap.data()) : null;
      emit();
    }),
    onSnapshot(path(uid, "dailyEntries"), (snap) => {
      value.dailyEntries = snap.docs.map((row) => mapDaily(row.data())).filter((row): row is DailyEntry => row !== null);
      emit();
    }),
    onSnapshot(path(uid, "exercises"), (snap) => {
      value.exercises = snap.docs.map((row) => mapExercise(row.data(), row.id)).filter((row): row is Exercise => row !== null);
      emit();
    }),
    onSnapshot(path(uid, "trainingDays"), (snap) => {
      value.trainingDays = snap.docs.map((row) => mapDay(row.data())).filter((row): row is TrainingDayPlan => row !== null);
      emit();
    }),
    onSnapshot(path(uid, "topSets"), (snap) => {
      value.topSets = snap.docs.map((row) => mapTopSet(row.data(), row.id)).filter((row): row is TopSet => row !== null);
      emit();
    }),
    onSnapshot(path(uid, "targetHistory"), (snap) => {
      value.targets = snap.docs.map((row) => mapTarget(row.data(), row.id)).filter((row): row is TargetPeriod => row !== null);
      emit();
    }),
    onSnapshot(path(uid, "recommendations"), (snap) => {
      value.recommendations = snap.docs.map((row) => mapRecommendation(row.data(), row.id)).filter((row): row is StoredRecommendation => row !== null);
      emit();
    })
  ];
  return () => unsubs.forEach((unsubscribe) => unsubscribe());
}

export const saveDailyEntry = (uid: string, value: DailyEntry) =>
  queued(setDoc(doc(path(uid, "dailyEntries"), value.date), { ...value, updatedAt: serverTimestamp() }));
export const saveTopSet = (uid: string, value: TopSet) =>
  queued(setDoc(doc(path(uid, "topSets"), value.id), { ...value, updatedAt: serverTimestamp() }));
export const saveExercise = (uid: string, value: Exercise) =>
  queued(setDoc(doc(path(uid, "exercises"), value.id), { ...value, updatedAt: serverTimestamp() }));
export const saveTrainingDay = (uid: string, value: TrainingDayPlan) =>
  queued(setDoc(doc(path(uid, "trainingDays"), String(value.weekday)), { ...value, updatedAt: serverTimestamp() }));

export async function decideRecommendation(
  uid: string,
  value: StoredRecommendation,
  nextTargets?: TargetPeriod
) {
  const batch = writeBatch(db);
  batch.set(doc(path(uid, "recommendations"), value.id), { ...value, decidedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  if (nextTargets) {
    batch.set(doc(path(uid, "targetHistory"), nextTargets.id), { ...nextTargets, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }
  await queued(batch.commit());
}

export async function exportAll(uid: string) {
  const names = ["dailyEntries", "exercises", "trainingDays", "topSets", "targetHistory", "recommendations"] as const;
  const profile = await getDoc(doc(db, "users", uid, "profile", "main"));
  const rows = await Promise.all(names.map(async (name) => [
    name,
    (await getDocs(path(uid, name))).docs.map((item) => ({ id: item.id, ...item.data() }))
  ] as const));
  return { profile: profile.data() ?? null, ...Object.fromEntries(rows) };
}

export const cloudTrackerData: TrackerDataSource = {
  seedIfNeeded,
  subscribeTracker,
  saveDailyEntry,
  saveTopSet,
  saveExercise,
  saveTrainingDay,
  decideRecommendation,
  exportAll
};
