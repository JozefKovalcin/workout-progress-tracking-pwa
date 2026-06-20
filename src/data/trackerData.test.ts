import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredRecommendation } from "./trackerData";

const firestore = vi.hoisted(() => {
  let resolveCommit = () => {};
  const setDoc = vi.fn();
  const onSnapshot = vi.fn();
  const commit = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        resolveCommit = resolve;
      })
  );
  const batch = {
    set: vi.fn(),
    commit
  };
  return {
    batch,
    commit,
    setDoc,
    onSnapshot,
    resolveCommit: () => resolveCommit()
  };
});

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  onSnapshot: firestore.onSnapshot,
  serverTimestamp: vi.fn(() => "timestamp"),
  setDoc: firestore.setDoc,
  waitForPendingWrites: vi.fn(() => Promise.resolve()),
  writeBatch: vi.fn(() => firestore.batch)
}));
vi.mock("./firebase", () => ({ db: {} }));
vi.mock("./firebaseAuth", () => ({
  signInWithGoogle: vi.fn(),
  signOutCurrentUser: vi.fn(),
  subscribeUser: vi.fn()
}));

import {
  decideRecommendation,
  saveDailyEntry,
  saveTopSet,
  subscribeTracker
} from "./trackerData";

const recommendation = {
  id: "2026-07-02",
  windowStart: "2026-06-19",
  windowEnd: "2026-07-02",
  status: "rejected",
  action: "none",
  calorieDeltaTraining: 0,
  calorieDeltaRest: 0,
  confidence: "high",
  reasonCodes: [],
  missingData: [],
  metrics: {
    validWeightsWeek1: 7,
    validWeightsWeek2: 7,
    calorieDays: 14,
    waistDays: 14,
    calorieMeanAbsoluteErrorPct: 0,
    weeklyWeightChangePct: 0,
    weeklyWeightChangeKg: 0,
    waistChangeCm: 0,
    performancePercent: 0,
    repeatedExerciseDecline: false,
    averageSleep: 8,
    averageReadiness: 8,
    averageTrainingQuality: 8
  }
} satisfies StoredRecommendation;

describe("cloud recommendation decisions", () => {
  beforeEach(() => {
    firestore.batch.set.mockClear();
    firestore.commit.mockClear();
  });

  it("rejects overlapping decisions and allows a later separate decision", async () => {
    const first = decideRecommendation("user-1", recommendation);

    await expect(
      decideRecommendation("user-1", recommendation)
    ).rejects.toThrow("Rozhodnutie sa už ukladá.");
    expect(firestore.commit).toHaveBeenCalledOnce();

    firestore.resolveCommit();
    await first;

    const later = decideRecommendation("user-1", {
      ...recommendation,
      status: "accepted"
    });
    expect(firestore.commit).toHaveBeenCalledTimes(2);
    firestore.resolveCommit();
    await expect(later).resolves.toBeUndefined();
  });
});

describe("cloud writes", () => {
  beforeEach(() => {
    firestore.setDoc.mockClear();
  });

  it("omits undefined optional fields before sending data to Firestore", async () => {
    await saveDailyEntry("user-1", {
      date: "2026-06-19",
      dayTypeOverride: undefined,
      weightKg: 80.4,
      waistCm: 82,
      calories: 2900,
      sleepScore: 8,
      readinessScore: 10,
      trainingQualityScore: 8,
      updatedAtMs: 1
    });

    const dailyPayload = firestore.setDoc.mock.calls[0][1];
    expect(dailyPayload).not.toHaveProperty("dayTypeOverride");

    await saveTopSet("user-1", {
      id: "2026-06-19__bench",
      date: "2026-06-19",
      exerciseId: "bench",
      weightKg: 100,
      reps: 8,
      rir: 2,
      note: undefined,
      estimated1RmKg: 126.67,
      updatedAtMs: 1
    });

    const topSetPayload = firestore.setDoc.mock.calls[1][1];
    expect(topSetPayload).not.toHaveProperty("note");
  });

  it("writes both working sets to Firestore", async () => {
    await saveTopSet("user-1", {
      id: "2026-06-19__bench",
      date: "2026-06-19",
      exerciseId: "bench",
      weightKg: 100,
      reps: 6,
      rir: 2,
      estimated1RmKg: 120,
      sets: [
        { weightKg: 100, reps: 6, rir: 2, estimated1RmKg: 120 },
        { weightKg: 90, reps: 10, rir: 1, estimated1RmKg: 120 }
      ],
      updatedAtMs: 1
    });

    expect(firestore.setDoc.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        sets: [
          expect.objectContaining({ weightKg: 100, reps: 6 }),
          expect.objectContaining({ weightKg: 90, reps: 10 })
        ]
      })
    );
  });
});

describe("cloud top-set reads", () => {
  beforeEach(() => {
    firestore.onSnapshot.mockClear();
  });

  it("rejects a malformed second working set", () => {
    const listener = vi.fn();
    subscribeTracker("user-1", listener);
    const topSetCallback = firestore.onSnapshot.mock.calls[4][1];

    topSetCallback({
      docs: [{
        id: "2026-06-19__bench",
        data: () => ({
          date: "2026-06-19",
          exerciseId: "bench",
          weightKg: 100,
          reps: 6,
          rir: 2,
          estimated1RmKg: 120,
          sets: [
            { weightKg: 100, reps: 6, rir: 2, estimated1RmKg: 120 },
            { weightKg: 0, reps: 10, rir: 1, estimated1RmKg: 0 }
          ],
          updatedAtMs: 1
        })
      }]
    });

    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({ topSets: [] })
    );
  });
});
