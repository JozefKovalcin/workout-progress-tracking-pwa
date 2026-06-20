import { beforeEach, describe, expect, it, vi } from "vitest";
import { calculateE1Rm } from "../domain/performance";
import type { StoredRecommendation, TrackerSnapshot } from "./trackerData";
import { createDemoTrackerData, DEMO_STORAGE_KEY } from "./demoData";

describe("demo tracker data", () => {
  beforeEach(() => localStorage.clear());

  it("saves and edits a daily entry through the same subscription", async () => {
    const data = createDemoTrackerData(localStorage);
    await data.seedIfNeeded("demo");
    const listener = vi.fn<(snapshot: TrackerSnapshot) => void>();
    data.subscribeTracker("demo", listener);

    await data.saveDailyEntry("demo", {
      date: "2026-06-19",
      weightKg: 81.4,
      calories: 2900,
      updatedAtMs: 1
    });
    await data.saveDailyEntry("demo", {
      date: "2026-06-19",
      weightKg: 81.7,
      calories: 2950,
      updatedAtMs: 2
    });

    const latest = listener.mock.calls.at(-1)?.[0];
    expect(latest?.dailyEntries).toEqual([
      expect.objectContaining({
        date: "2026-06-19",
        weightKg: 81.7,
        calories: 2950
      })
    ]);
    expect(JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY) ?? "{}")).toBeTruthy();
  });

  it("persists a top set with the calculated e1RM", async () => {
    const data = createDemoTrackerData(localStorage);
    await data.seedIfNeeded("demo");

    await data.saveTopSet("demo", {
      id: "2026-06-19__rdl",
      date: "2026-06-19",
      exerciseId: "rdl",
      weightKg: 120,
      reps: 8,
      rir: 1,
      estimated1RmKg: calculateE1Rm(120, 8),
      updatedAtMs: 1
    });

    const exported = await data.exportAll("demo");
    expect(exported.topSets).toEqual([
      expect.objectContaining({
        id: "2026-06-19__rdl",
        estimated1RmKg: 152
      })
    ]);
  });

  it("round-trips both working sets", async () => {
    const data = createDemoTrackerData(localStorage);
    await data.seedIfNeeded("demo");

    await data.saveTopSet("demo", {
      id: "2026-06-19__rdl",
      date: "2026-06-19",
      exerciseId: "rdl",
      weightKg: 120,
      reps: 8,
      rir: 1,
      estimated1RmKg: 152,
      sets: [
        { weightKg: 120, reps: 8, rir: 1, estimated1RmKg: 152 },
        { weightKg: 110, reps: 10, rir: 2, estimated1RmKg: 146.67 }
      ],
      updatedAtMs: 1
    });

    const exported = await data.exportAll("demo");
    expect(exported.topSets).toEqual([
      expect.objectContaining({
        sets: [
          expect.objectContaining({ weightKg: 120, reps: 8 }),
          expect.objectContaining({ weightKg: 110, reps: 10 })
        ]
      })
    ]);
  });

  it("rejects overlapping decisions and allows a later separate decision", async () => {
    const data = createDemoTrackerData(localStorage);
    await data.seedIfNeeded("demo");
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

    const first = data.decideRecommendation("demo", recommendation);
    await expect(
      data.decideRecommendation("demo", recommendation)
    ).rejects.toThrow("Rozhodnutie sa už ukladá.");
    await first;

    await expect(
      data.decideRecommendation("demo", {
        ...recommendation,
        status: "accepted"
      })
    ).resolves.toBeUndefined();
  });
});
