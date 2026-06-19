import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredRecommendation } from "./trackerData";

const firestore = vi.hoisted(() => {
  let resolveCommit = () => {};
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
    resolveCommit: () => resolveCommit()
  };
});

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
  serverTimestamp: vi.fn(() => "timestamp"),
  setDoc: vi.fn(),
  waitForPendingWrites: vi.fn(() => Promise.resolve()),
  writeBatch: vi.fn(() => firestore.batch)
}));
vi.mock("./firebase", () => ({ db: {} }));
vi.mock("./firebaseAuth", () => ({
  signInWithGoogle: vi.fn(),
  signOutCurrentUser: vi.fn(),
  subscribeUser: vi.fn()
}));

import { decideRecommendation } from "./trackerData";

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
