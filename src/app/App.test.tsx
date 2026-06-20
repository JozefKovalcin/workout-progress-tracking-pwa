/// <reference types="@testing-library/jest-dom" />

import { addDays } from "date-fns";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { calculateMacros } from "../domain/macros";
import { buildEvaluationMetrics } from "../domain/analytics";
import { fromLocalDate, toLocalDate } from "../domain/date";
import type { DailyEntry, LocalDate, TargetPeriod, TopSet } from "../domain/types";
import { makeTopSet } from "../test/fixtures";
import type {
  StoredRecommendation,
  TrackerDataSource,
  TrackerSnapshot
} from "../data/trackerData";
import { App } from "./App";
import {
  advanceInformationalBlocks,
  anchorBlockEntries,
  deriveBlock
} from "./recommendationFlow";

const demoMock = vi.hoisted(() => ({
  source: null as TrackerDataSource | null
}));
const cloudMock = vi.hoisted(() => ({
  source: null as TrackerDataSource | null,
  authCallback: null as ((user: { uid: string } | null) => void) | null,
  signIn: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("../data/demoData", () => ({
  createDemoTrackerData: () => demoMock.source
}));
vi.mock("../data/firebaseAuth", () => ({
  signInWithGoogle: () => cloudMock.signIn()
}));
vi.mock("../data/trackerData", () => ({
  get cloudTrackerData() {
    return cloudMock.source;
  },
  subscribeUser: (callback: (user: { uid: string } | null) => void) => {
    cloudMock.authCallback = callback;
    return vi.fn();
  },
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
  it("advances an initial hold result to the next block", () => {
    expect(
      advanceInformationalBlocks(
        "2026-06-19",
        14,
        "2026-07-03",
        () => "hold"
      )
    ).toMatchObject({
      blockStart: "2026-07-03",
      blockEnd: "2026-07-16",
      actionable: false
    });
  });

  it("advances an insufficient result to the next block", () => {
    expect(
      advanceInformationalBlocks(
        "2026-06-19",
        14,
        "2026-07-03",
        () => "insufficient"
      ).blockStart
    ).toBe("2026-07-03");
  });

  it("keeps an actionable pending proposal fixed", () => {
    expect(
      advanceInformationalBlocks(
        "2026-06-19",
        14,
        "2026-07-17",
        () => "pending"
      )
    ).toMatchObject({
      blockStart: "2026-06-19",
      blockEnd: "2026-07-02",
      actionable: true
    });
  });

  it("advances across multiple informational blocks", () => {
    const statuses = ["hold", "insufficient"] as const;

    expect(
      advanceInformationalBlocks(
        "2026-06-19",
        14,
        "2026-07-17",
        (_blockStart, _blockEnd, index) => statuses[index]
      )
    ).toMatchObject({
      blockStart: "2026-07-17",
      blockEnd: "2026-07-30",
      day: 1,
      actionable: false
    });
  });

  it("stops on an incomplete current block without evaluating it", () => {
    const evaluate = vi.fn(() => "hold" as const);

    expect(
      advanceInformationalBlocks(
        "2026-06-19",
        14,
        "2026-07-02",
        evaluate
      )
    ).toMatchObject({
      blockStart: "2026-06-19",
      blockEnd: "2026-07-02",
      actionable: false
    });
    expect(evaluate).not.toHaveBeenCalled();
  });

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

  it("shows saving progress and confirms a saved daily entry", async () => {
    let resolveSave = () => {};
    const data = makeDataSource();
    vi.mocked(data.saveDailyEntry).mockImplementation(
      () => new Promise<void>((resolve) => {
        resolveSave = resolve;
      })
    );
    demoMock.source = data;
    render(<App initialMode="demo" now={new Date(2026, 5, 19)} />);

    fireEvent.change(await screen.findByLabelText("Hmotnosť (kg)"), {
      target: { value: "81.4" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Uložiť deň" }));

    expect(screen.getByRole("button", { name: "Ukladám…" })).toBeDisabled();

    await act(async () => {
      resolveSave();
      await Promise.resolve();
    });

    expect(await screen.findByText("Deň uložený.")).toBeVisible();
  });

  it("saves all daily score fields together", async () => {
    const data = makeDataSource();
    demoMock.source = data;
    render(<App initialMode="demo" now={new Date(2026, 5, 19)} />);

    fireEvent.change(await screen.findByLabelText("Hmotnosť (kg)"), {
      target: { value: "80.4" }
    });
    fireEvent.change(screen.getByLabelText("Pás (cm)"), {
      target: { value: "82" }
    });
    fireEvent.change(screen.getByLabelText("Kalórie"), {
      target: { value: "2900" }
    });
    fireEvent.change(screen.getByLabelText("Spánok 1–10"), {
      target: { value: "8" }
    });
    fireEvent.change(screen.getByLabelText("Pripravenosť 1–10"), {
      target: { value: "10" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Prepnúť na tréning" }));
    fireEvent.change(screen.getByLabelText("Kvalita tréningu 1–10"), {
      target: { value: "8" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Uložiť deň" }));

    await waitFor(() => expect(data.saveDailyEntry).toHaveBeenCalledOnce());
    expect(data.saveDailyEntry).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({
        date: "2026-06-19",
        dayTypeOverride: "training",
        weightKg: 80.4,
        waistCm: 82,
        calories: 2900,
        sleepScore: 8,
        readinessScore: 10,
        trainingQualityScore: 8
      })
    );
  });

  it("saves two working sets and shows their average e1RM", async () => {
    const data = makeDataSource(makeSnapshot({
      exercises: [{
        id: "bench",
        name: "Bench press",
        muscleGroup: "Hrudník",
        repMin: 6,
        repMax: 10,
        isMain: true
      }],
      trainingDays: [{
        weekday: 5,
        label: "Push",
        enabled: true,
        exerciseIds: ["bench"]
      }]
    }));
    demoMock.source = data;
    render(<App initialMode="demo" now={new Date(2026, 5, 19)} />);

    fireEvent.click((await screen.findAllByRole("button", { name: "Tréning" }))[0]);
    expect(document.querySelectorAll(".working-sets .working-set")).toHaveLength(2);
    fireEvent.change(await screen.findByLabelText("Séria 1 kg"), {
      target: { value: "100" }
    });
    fireEvent.change(screen.getByLabelText("Séria 1 opakovania"), {
      target: { value: "6" }
    });
    fireEvent.change(screen.getByLabelText("Séria 1 RIR"), {
      target: { value: "2" }
    });
    fireEvent.change(screen.getByLabelText("Séria 2 kg"), {
      target: { value: "90" }
    });
    fireEvent.change(screen.getByLabelText("Séria 2 opakovania"), {
      target: { value: "10" }
    });
    fireEvent.change(screen.getByLabelText("Séria 2 RIR"), {
      target: { value: "1" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Uložiť 2 série" }));

    await waitFor(() => expect(data.saveTopSet).toHaveBeenCalledOnce());
    expect(data.saveTopSet).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({
        weightKg: 100,
        reps: 6,
        rir: 2,
        sets: [
          expect.objectContaining({ weightKg: 100, reps: 6, rir: 2 }),
          expect.objectContaining({ weightKg: 90, reps: 10, rir: 1 })
        ]
      })
    );
    expect(await screen.findByText(/Priemerné e1RM 120\.0 kg/)).toBeVisible();
    expect(screen.getByText("Tréning uložený.")).toBeVisible();
  });

  it("shows a training save error and unlocks the two-set button", async () => {
    const data = makeDataSource(makeSnapshot({
      exercises: [{
        id: "bench",
        name: "Bench press",
        muscleGroup: "Hrudník",
        repMin: 6,
        repMax: 10,
        isMain: true
      }],
      trainingDays: [{
        weekday: 5,
        label: "Push",
        enabled: true,
        exerciseIds: ["bench"]
      }]
    }));
    vi.mocked(data.saveTopSet).mockRejectedValue(new Error("Cloud je nedostupný."));
    demoMock.source = data;
    render(<App initialMode="demo" now={new Date(2026, 5, 19)} />);

    fireEvent.click((await screen.findAllByRole("button", { name: "Tréning" }))[0]);
    for (const [label, value] of [
      ["Séria 1 kg", "100"],
      ["Séria 1 opakovania", "6"],
      ["Séria 1 RIR", "2"],
      ["Séria 2 kg", "90"],
      ["Séria 2 opakovania", "10"],
      ["Séria 2 RIR", "1"]
    ]) {
      fireEvent.change(await screen.findByLabelText(label), { target: { value } });
    }
    fireEvent.click(screen.getByRole("button", { name: "Uložiť 2 série" }));

    expect(await screen.findByText("Uloženie tréningu zlyhalo: Cloud je nedostupný.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Uložiť 2 série" })).toBeEnabled();
  });

  it("does not treat a blank RIR as zero", async () => {
    const data = makeDataSource(makeSnapshot({
      exercises: [{
        id: "bench",
        name: "Bench press",
        muscleGroup: "Hrudník",
        repMin: 6,
        repMax: 10,
        isMain: true
      }],
      trainingDays: [{
        weekday: 5,
        label: "Push",
        enabled: true,
        exerciseIds: ["bench"]
      }]
    }));
    demoMock.source = data;
    render(<App initialMode="demo" now={new Date(2026, 5, 19)} />);

    fireEvent.click((await screen.findAllByRole("button", { name: "Tréning" }))[0]);
    for (const [label, value] of [
      ["Séria 1 kg", "100"],
      ["Séria 1 opakovania", "6"],
      ["Séria 2 kg", "90"],
      ["Séria 2 opakovania", "10"],
      ["Séria 2 RIR", "1"]
    ]) {
      fireEvent.change(await screen.findByLabelText(label), { target: { value } });
    }
    fireEvent.click(screen.getByRole("button", { name: "Uložiť 2 série" }));

    expect(await screen.findByText(/Séria 1: RIR musí byť 0–10\./)).toBeVisible();
    expect(data.saveTopSet).not.toHaveBeenCalled();
  });

  it("shows selectable weight, waist, calorie and exercise-strength charts", async () => {
    demoMock.source = makeDataSource(makeSnapshot({
      dailyEntries: [
        { date: "2026-06-14", weightKg: 79, waistCm: 81.5, calories: 2750, updatedAtMs: 1 },
        { date: "2026-06-15", weightKg: 80, waistCm: 82, calories: 2800, updatedAtMs: 2 },
        { date: "2026-06-20", weightKg: 81, waistCm: 82.5, calories: 2900, updatedAtMs: 3 }
      ],
      exercises: [{
        id: "bench",
        name: "Bench press",
        muscleGroup: "Hrudník",
        repMin: 6,
        repMax: 10,
        isMain: true
      }],
      topSets: [
        makeTopSet({ id: "old", date: "2026-06-14", exerciseId: "bench", estimated1RmKg: 100 }),
        makeTopSet({
          id: "new",
          date: "2026-06-20",
          exerciseId: "bench",
          sets: [
            { weightKg: 100, reps: 6, rir: 2, estimated1RmKg: 120 },
            { weightKg: 90, reps: 10, rir: 1, estimated1RmKg: 120 }
          ]
        })
      ]
    }));
    render(<App initialMode="demo" now={new Date(2026, 5, 20)} />);

    fireEvent.click((await screen.findAllByRole("button", { name: "Progress" }))[0]);

    expect(await screen.findByRole("button", { name: "7 dní" })).toBeVisible();
    expect(screen.getByRole("button", { name: "30 dní" })).toBeVisible();
    expect(screen.getByRole("button", { name: "90 dní" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Všetko" })).toBeVisible();
    expect(screen.getByLabelText("Cvik pre graf sily")).toHaveValue("bench");
    expect(screen.getByRole("img", { name: "Graf hmotnosti" })).toBeVisible();
    expect(screen.getByRole("img", { name: "Graf pásu" })).toBeVisible();
    expect(screen.getByRole("img", { name: "Graf kalórií" })).toBeVisible();
    expect(screen.getByRole("img", { name: "Graf sily Bench press" })).toBeVisible();
    const chartGrid = document.querySelector(".chart-grid");
    expect(chartGrid).toBeInTheDocument();
    expect(within(chartGrid as HTMLElement).getAllByRole("img")).toHaveLength(4);
    const weightPoints = screen.getByRole("img", { name: "Graf hmotnosti" }).querySelectorAll("circle");
    expect(Number(weightPoints[1].getAttribute("cx"))).toBeLessThan(200);
  });

  it("shows app validation instead of silently blocking a decimal score", async () => {
    render(<App initialMode="demo" now={new Date(2026, 5, 19)} />);

    fireEvent.change(await screen.findByLabelText("Spánok 1–10"), {
      target: { value: "7.5" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Uložiť deň" }));

    expect(
      await screen.findByText("Spánok musí byť na škále 1–10.")
    ).toBeVisible();
  });

  it("shows a daily save error and unlocks the button", async () => {
    const data = makeDataSource();
    vi.mocked(data.saveDailyEntry).mockRejectedValue(
      new Error("Missing or insufficient permissions.")
    );
    demoMock.source = data;
    render(<App initialMode="demo" now={new Date(2026, 5, 19)} />);

    fireEvent.change(await screen.findByLabelText("Hmotnosť (kg)"), {
      target: { value: "81.4" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Uložiť deň" }));

    expect(
      await screen.findByText("Uloženie zlyhalo: Missing or insufficient permissions.")
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Uložiť deň" })).toBeEnabled();
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

  it("locks both recommendation decisions after the first rapid click", async () => {
    let resolveDecision = () => {};
    const data = makeDataSource(pendingSnapshot());
    vi.mocked(data.decideRecommendation).mockImplementation(
      () => new Promise<void>((resolve) => {
        resolveDecision = resolve;
      })
    );
    demoMock.source = data;
    render(<App initialMode="demo" now={new Date(2026, 6, 3)} />);

    const accept = await screen.findByRole("button", { name: "Prijať" });
    const reject = screen.getByRole("button", { name: "Odmietnuť" });
    fireEvent.click(accept);
    fireEvent.click(reject);

    expect(data.decideRecommendation).toHaveBeenCalledOnce();
    expect(accept).toBeDisabled();
    expect(reject).toBeDisabled();
    expect(screen.getByRole("button", { name: "Ukladám…" })).toBeVisible();

    await act(async () => {
      resolveDecision();
      await Promise.resolve();
    });
  });

  it("unlocks recommendation decisions and shows an error after a failed save", async () => {
    const data = makeDataSource(pendingSnapshot());
    vi.mocked(data.decideRecommendation).mockRejectedValue(
      new Error("Rozhodnutie sa už ukladá.")
    );
    demoMock.source = data;
    render(<App initialMode="demo" now={new Date(2026, 6, 3)} />);

    fireEvent.click(await screen.findByRole("button", { name: "Prijať" }));

    expect(await screen.findByText("Rozhodnutie sa už ukladá.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Prijať" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Odmietnuť" })).toBeEnabled();
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
    cloudMock.signIn.mockReset();
    cloudMock.signIn.mockResolvedValue(undefined);
  });

  it("offers Google sign-in immediately without waiting for an auth preload", () => {
    render(<App now={new Date(2026, 5, 20)} />);

    expect(
      screen.getByRole("button", { name: "Pokračovať cez Google" })
    ).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Načítavam prihlásenie…" })
    ).not.toBeInTheDocument();
  });

  it("locks the Google button while popup authentication is running", async () => {
    let resolveSignIn = () => {};
    cloudMock.signIn.mockImplementation(() => new Promise<void>((resolve) => {
      resolveSignIn = resolve;
    }));

    render(<App now={new Date(2026, 5, 20)} />);

    fireEvent.click(await screen.findByRole("button", { name: "Pokračovať cez Google" }));

    expect(cloudMock.signIn).toHaveBeenCalledOnce();
    expect(await screen.findByRole("button", { name: "Prihlasujem…" })).toBeDisabled();

    await act(async () => {
      resolveSignIn();
      await Promise.resolve();
    });
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
