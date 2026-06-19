/// <reference types="@testing-library/jest-dom" />

import { addDays } from "date-fns";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { calculateMacros } from "../domain/macros";
import { buildEvaluationMetrics } from "../domain/analytics";
import { fromLocalDate, toLocalDate } from "../domain/date";
import type { DailyEntry, LocalDate, TargetPeriod, TopSet } from "../domain/types";
import type {
  StoredRecommendation,
  TrackerDataSource,
  TrackerSnapshot
} from "../data/trackerData";
import { App } from "./App";
import { anchorBlockEntries, deriveBlock } from "./recommendationFlow";

const demoMock = vi.hoisted(() => ({
  source: null as TrackerDataSource | null
}));
const cloudMock = vi.hoisted(() => ({
  source: null as TrackerDataSource | null,
  authCallback: null as ((user: { uid: string } | null) => void) | null
}));

vi.mock("../data/demoData", () => ({
  createDemoTrackerData: () => demoMock.source
}));
vi.mock("../data/trackerData", () => ({
  cloudTrackerData: cloudMock.source,
  subscribeUser: (callback: (user: { uid: string } | null) => void) => {
    cloudMock.authCallback = callback;
    return vi.fn();
  },
  signInWithGoogle: vi.fn().mockResolvedValue(undefined),
  signOutCurrentUser: vi.fn().mockResolvedValue(undefined)
}));

const profile = {
  startDate: "2026-06-19" as LocalDate,
  startingWeightKg: 81.4,
  trainingCalories: 2900,
  restCalories: 2700,
  proteinGrams: 180,
  fatGrams: 50,
  evaluationDays: 14 as const,
  targetGainMinPct: 0.2,
  targetGainMaxPct: 0.35
};

const initialTarget: TargetPeriod = {
  id: profile.startDate,
  effectiveDate: profile.startDate,
  training: calculateMacros(2900, 180, 50),
  rest: calculateMacros(2700, 180, 50),
  reason: "Initial",
  createdAtMs: 1
};

function completeEntries(): DailyEntry[] {
  return Array.from({ length: 14 }, (_, index) => ({
    date: toLocalDate(addDays(fromLocalDate(profile.startDate), index)),
    weightKg: 81.4,
    waistCm: 82,
    calories: 2700,
    sleepScore: 8,
    readinessScore: 8,
    trainingQualityScore: 8,
    dayTypeOverride: "rest",
    updatedAtMs: index + 1
  }));
}

const topSets: TopSet[] = [
  {
    id: "2026-06-20__rdl",
    date: "2026-06-20",
    exerciseId: "rdl",
    weightKg: 100,
    reps: 8,
    rir: 1,
    estimated1RmKg: 126.67,
    updatedAtMs: 1
  },
  {
    id: "2026-07-02__rdl",
    date: "2026-07-02",
    exerciseId: "rdl",
    weightKg: 100,
    reps: 8,
    rir: 1,
    estimated1RmKg: 126.67,
    updatedAtMs: 2
  }
];

function makeSnapshot(overrides: Partial<TrackerSnapshot> = {}): TrackerSnapshot {
  return {
    profile,
    dailyEntries: [],
    exercises: [],
    trainingDays: [],
    topSets: [],
    targets: [initialTarget],
    recommendations: [],
    ...overrides
  };
}

function makeDataSource(
  snapshot: TrackerSnapshot = makeSnapshot(),
  seedIfNeeded: TrackerDataSource["seedIfNeeded"] = vi.fn().mockResolvedValue(undefined)
): TrackerDataSource {
  return {
    seedIfNeeded,
    subscribeTracker: vi.fn((_uid, cb) => {
      cb(snapshot);
      return vi.fn();
    }),
    saveDailyEntry: vi.fn().mockResolvedValue(undefined),
    saveTopSet: vi.fn().mockResolvedValue(undefined),
    saveExercise: vi.fn().mockResolvedValue(undefined),
    saveTrainingDay: vi.fn().mockResolvedValue(undefined),
    decideRecommendation: vi.fn().mockResolvedValue(undefined),
    exportAll: vi.fn().mockResolvedValue({})
  };
}

function pendingSnapshot(overrides: Partial<TrackerSnapshot> = {}) {
  return makeSnapshot({
    dailyEntries: completeEntries(),
    topSets,
    ...overrides
  });
}

describe("recommendation flow helpers", () => {
  it("makes a block actionable only after its fourteenth date", () => {
    expect(deriveBlock(profile, [initialTarget], [], "2026-07-02")).toMatchObject({
      blockStart: "2026-06-19",
      blockEnd: "2026-07-02",
      actionable: false
    });
    expect(deriveBlock(profile, [initialTarget], [], "2026-07-03").actionable).toBe(true);
  });

  it("uses accepted target effective dates and rejected decision dates as recurring block markers", () => {
    const futureTarget = { ...initialTarget, id: "2026-07-06", effectiveDate: "2026-07-06" as LocalDate };
    const rejected = {
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
      },
      decidedAtMs: fromLocalDate("2026-07-03").valueOf()
    } satisfies StoredRecommendation;

    expect(deriveBlock(profile, [initialTarget, futureTarget], [], "2026-07-05").blockStart)
      .toBe("2026-06-19");
    expect(deriveBlock(profile, [initialTarget, futureTarget], [], "2026-07-06"))
      .toMatchObject({ blockStart: "2026-07-06", blockEnd: "2026-07-19" });
    expect(deriveBlock(profile, [initialTarget], [rejected], "2026-07-03"))
      .toMatchObject({ blockStart: "2026-07-03", blockEnd: "2026-07-16" });
  });

  it("anchors metrics to the exact block and lets a real start-day row beat the blank anchor", () => {
    const entries = completeEntries().slice(1);
    entries.push({
      date: "2026-07-03",
      weightKg: 99,
      calories: 9999,
      updatedAtMs: 100
    });
    const anchored = anchorBlockEntries(entries, "2026-06-19", "2026-07-02");
    const metrics = buildEvaluationMetrics(
      anchored,
      () => initialTarget.rest,
      {
        overallPercent: 0,
        comparableExercises: 1,
        items: [],
        repeatedDeclineExerciseIds: []
      }
    );

    expect(metrics.validWeightsWeek1).toBe(6);
    expect(metrics.validWeightsWeek2).toBe(7);
    expect(metrics.calorieDays).toBe(13);
    expect(anchored.some((entry) => entry.date === "2026-07-03")).toBe(false);

    const realStart = { ...completeEntries()[0], updatedAtMs: 5 };
    const withRealStart = anchorBlockEntries([realStart, ...entries], "2026-06-19", "2026-07-02");
    expect(Math.min(...withRealStart.filter((entry) => entry.date === "2026-06-19").map((entry) => entry.updatedAtMs)))
      .toBeLessThan(realStart.updatedAtMs);
    expect(buildEvaluationMetrics(withRealStart, () => initialTarget.rest, {
      overallPercent: 0,
      comparableExercises: 1,
      items: [],
      repeatedDeclineExerciseIds: []
    }).validWeightsWeek1).toBe(7);
  });
});

describe("App demo mode", () => {
  beforeEach(() => {
    localStorage.clear();
    demoMock.source = makeDataSource();
  });

  it("renders the navigation and Today screen", async () => {
    render(<App initialMode="demo" now={new Date(2026, 5, 19)} />);

    expect(await screen.findByRole("heading", { name: "Dnes" })).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Dnes" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Tréning" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Progress" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Nastavenia" })).toHaveLength(2);
  });

  it("does not offer Accept on day 14", async () => {
    demoMock.source = makeDataSource(pendingSnapshot());
    render(<App initialMode="demo" now={new Date(2026, 6, 2)} />);

    expect(await screen.findByText(/Kalibrácia deň 14\/14/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Prijať" })).not.toBeInTheDocument();
  });

  it("offers Accept on the day after a completed block", async () => {
    demoMock.source = makeDataSource(pendingSnapshot());
    render(<App initialMode="demo" now={new Date(2026, 6, 3)} />);

    expect(await screen.findByRole("button", { name: "Prijať" })).toBeVisible();
  });

  it("makes an accepted target effective tomorrow from a delayed acceptance date", async () => {
    const data = makeDataSource(pendingSnapshot());
    demoMock.source = data;
    render(<App initialMode="demo" now={new Date(2026, 6, 5)} />);

    fireEvent.click(await screen.findByRole("button", { name: "Prijať" }));

    await waitFor(() => expect(data.decideRecommendation).toHaveBeenCalledOnce());
    const [, recommendation, target] = vi.mocked(data.decideRecommendation).mock.calls[0];
    expect(recommendation.id).toBe("2026-07-02");
    expect(recommendation.decidedAtMs).toBe(fromLocalDate("2026-07-05").valueOf());
    expect(target?.effectiveDate).toBe("2026-07-06");
  });

  it("keeps the accepted state before its future target starts without offering a new action", async () => {
    const pending = pendingSnapshot();
    const metrics = buildEvaluationMetrics(pending.dailyEntries, () => initialTarget.rest, {
      overallPercent: 0,
      comparableExercises: 1,
      items: [],
      repeatedDeclineExerciseIds: []
    });
    const accepted: StoredRecommendation = {
      id: "2026-07-02",
      windowStart: "2026-06-19",
      windowEnd: "2026-07-02",
      metrics,
      status: "accepted",
      action: "increase_training",
      calorieDeltaTraining: 100,
      calorieDeltaRest: 0,
      confidence: "high",
      reasonCodes: ["STABLE_WEIGHT"],
      missingData: [],
      decidedAtMs: fromLocalDate("2026-07-05").valueOf()
    };
    const futureTarget = {
      ...initialTarget,
      id: "2026-07-06",
      effectiveDate: "2026-07-06" as LocalDate
    };
    demoMock.source = makeDataSource(pendingSnapshot({
      targets: [initialTarget, futureTarget],
      recommendations: [accepted]
    }));

    render(<App initialMode="demo" now={new Date(2026, 6, 5)} />);

    expect(await screen.findByText(/Odporúčanie prijaté/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Prijať" })).not.toBeInTheDocument();
  });

  it("does not subscribe when seed resolves after unmount", async () => {
    let resolveSeed = () => {};
    const seed = vi.fn(() => new Promise<void>((resolve) => {
      resolveSeed = resolve;
    }));
    const data = makeDataSource(makeSnapshot(), seed);
    demoMock.source = data;
    const view = render(<App initialMode="demo" now={new Date(2026, 5, 19)} />);

    view.unmount();
    await act(async () => {
      resolveSeed();
      await Promise.resolve();
    });

    expect(data.subscribeTracker).not.toHaveBeenCalled();
  });
});

describe("App cloud mode", () => {
  beforeEach(() => {
    localStorage.clear();
    cloudMock.source = null;
    cloudMock.authCallback = null;
  });

  it("hides the previous user's snapshot while the next user is loading", async () => {
    let resolveUserBSeed = () => {};
    const userASnapshot = makeSnapshot({
      exercises: [{
        id: "user-a-only",
        name: "User A only exercise",
        muscleGroup: "Test",
        repMin: 6,
        repMax: 12,
        isMain: true
      }]
    });
    const data = makeDataSource(userASnapshot, vi.fn((uid: string) => {
      if (uid === "user-b") {
        return new Promise<void>((resolve) => {
          resolveUserBSeed = resolve;
        });
      }
      return Promise.resolve();
    }));
    cloudMock.source = data;

    render(<App initialMode="cloud" now={new Date(2026, 5, 19)} />);

    await waitFor(() => expect(cloudMock.authCallback).not.toBeNull());
    act(() => cloudMock.authCallback?.({ uid: "user-a" }));
    fireEvent.click((await screen.findAllByRole("button", { name: "Nastavenia" }))[0]);
    expect(await screen.findByDisplayValue("User A only exercise")).toBeVisible();

    act(() => cloudMock.authCallback?.({ uid: "user-b" }));

    const staleInput = screen.queryByDisplayValue("User A only exercise");
    if (staleInput) fireEvent.submit(staleInput.closest("form")!);

    expect(staleInput).not.toBeInTheDocument();
    expect(data.saveExercise).not.toHaveBeenCalledWith(
      "user-b",
      expect.objectContaining({ id: "user-a-only" })
    );

    await act(async () => {
      resolveUserBSeed();
      await Promise.resolve();
    });
  });
});
