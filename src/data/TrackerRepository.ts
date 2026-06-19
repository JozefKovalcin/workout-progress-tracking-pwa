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

export interface StoredRecommendation extends RecommendationResult {
  id: string;
  windowStart: LocalDate;
  windowEnd: LocalDate;
  metrics: RecommendationMetrics;
  decidedAtMs?: number;
}

export interface TrackerRepository {
  ensureSeedData(
    profile: TrackerProfile,
    exercises: Exercise[],
    plan: TrainingDayPlan[]
  ): Promise<void>;
  subscribeProfile(cb: (profile: TrackerProfile) => void): () => void;
  subscribeDailyEntries(
    start: LocalDate,
    end: LocalDate,
    cb: (rows: DailyEntry[]) => void
  ): () => void;
  saveDailyEntry(entry: DailyEntry): Promise<void>;
  subscribeExercises(cb: (rows: Exercise[]) => void): () => void;
  saveExercise(exercise: Exercise): Promise<void>;
  subscribeTrainingPlan(cb: (rows: TrainingDayPlan[]) => void): () => void;
  saveTrainingDay(day: TrainingDayPlan): Promise<void>;
  subscribeTopSets(
    start: LocalDate,
    end: LocalDate,
    cb: (rows: TopSet[]) => void
  ): () => void;
  saveTopSet(set: TopSet): Promise<void>;
  subscribeTargets(cb: (rows: TargetPeriod[]) => void): () => void;
  subscribeRecommendations(
    cb: (rows: StoredRecommendation[]) => void
  ): () => void;
  saveRecommendation(value: StoredRecommendation): Promise<void>;
  acceptRecommendation(
    value: StoredRecommendation,
    nextTargets: TargetPeriod
  ): Promise<void>;
  rejectRecommendation(value: StoredRecommendation): Promise<void>;
  exportAll(): Promise<Record<string, unknown>>;
}
