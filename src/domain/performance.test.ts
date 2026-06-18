import { describe, expect, it } from "vitest";
import { makeTopSet } from "../test/fixtures";
import { calculateE1Rm, summarizePerformance } from "./performance";
import type { LocalDate, TopSet } from "./types";

function topSet(
  exerciseId: string,
  date: LocalDate,
  weightKg: number,
  reps = 0,
  rir = 1
): TopSet {
  return makeTopSet({
    id: `${exerciseId}-${date}-${weightKg}`,
    exerciseId,
    date,
    weightKg,
    reps,
    rir
  });
}

describe("calculateE1Rm", () => {
  it("uses the Epley formula", () => {
    expect(calculateE1Rm(100, 6)).toBe(120);
  });
});

describe("summarizePerformance", () => {
  it("summarizes positive changes for two exercises with an equal-weight mean", () => {
    const summary = summarizePerformance(
      [
        topSet("squat", "2026-06-10", 100),
        topSet("squat", "2026-06-18", 110),
        topSet("bench", "2026-06-11", 50),
        topSet("bench", "2026-06-17", 60)
      ],
      "2026-06-18"
    );

    expect(summary.comparableExercises).toBe(2);
    expect(summary.overallPercent).toBeCloseTo(15);
    expect(summary.items).toHaveLength(2);
    expect(summary.items[0]).toEqual(
      expect.objectContaining({
        exerciseId: "bench",
        current: expect.objectContaining({ date: "2026-06-17" }),
        previous: expect.objectContaining({ date: "2026-06-11" }),
        isPr: true,
        reliability: "normal"
      })
    );
    expect(summary.items[0]?.percentChange).toBeCloseTo(20);
    expect(summary.items[1]).toEqual(
      expect.objectContaining({
        exerciseId: "squat",
        current: expect.objectContaining({ date: "2026-06-18" }),
        previous: expect.objectContaining({ date: "2026-06-10" }),
        isPr: true,
        reliability: "normal"
      })
    );
    expect(summary.items[1]?.percentChange).toBeCloseTo(10);
  });

  it("uses persisted estimated 1RM values instead of recalculating from weight and reps", () => {
    const summary = summarizePerformance(
      [
        makeTopSet({
          id: "squat-old",
          exerciseId: "squat",
          date: "2026-06-01",
          weightKg: 100,
          reps: 0,
          estimated1RmKg: 120
        }),
        makeTopSet({
          id: "squat-previous",
          exerciseId: "squat",
          date: "2026-06-10",
          weightKg: 110,
          reps: 0,
          estimated1RmKg: 100
        }),
        makeTopSet({
          id: "squat-current",
          exerciseId: "squat",
          date: "2026-06-18",
          weightKg: 121,
          reps: 0,
          estimated1RmKg: 90
        })
      ],
      "2026-06-18"
    );

    expect(summary.items[0]?.percentChange).toBeCloseTo(-10);
    expect(summary.items[0]?.isPr).toBe(false);
    expect(summary.repeatedDeclineExerciseIds).toEqual(["squat"]);
  });

  it("excludes an exercise with no set before its current set", () => {
    const summary = summarizePerformance(
      [topSet("squat", "2026-06-18", 100)],
      "2026-06-18"
    );

    expect(summary).toEqual({
      overallPercent: null,
      comparableExercises: 0,
      items: [],
      repeatedDeclineExerciseIds: []
    });
  });

  it("marks reliability low when RIR differs by more than 1.5", () => {
    const summary = summarizePerformance(
      [
        topSet("squat", "2026-06-10", 100, 0, 0),
        topSet("squat", "2026-06-18", 105, 0, 2)
      ],
      "2026-06-18"
    );

    expect(summary.items[0]?.reliability).toBe("low");
  });

  it("requires a PR to exceed the historical max by more than 0.5%", () => {
    const atThreshold = summarizePerformance(
      [
        topSet("squat", "2026-06-10", 100),
        topSet("squat", "2026-06-18", 100.5)
      ],
      "2026-06-18"
    );
    const aboveThreshold = summarizePerformance(
      [
        topSet("squat", "2026-06-10", 100),
        topSet("squat", "2026-06-18", 100.51)
      ],
      "2026-06-18"
    );

    expect(atThreshold.items[0]?.isPr).toBe(false);
    expect(aboveThreshold.items[0]?.isPr).toBe(true);
  });

  it("ignores future sets after the end date", () => {
    const summary = summarizePerformance(
      [
        topSet("squat", "2026-06-10", 100),
        topSet("squat", "2026-06-18", 110),
        topSet("squat", "2026-06-20", 200)
      ],
      "2026-06-18"
    );

    expect(summary.items[0]?.current.date).toBe("2026-06-18");
    expect(summary.items[0]?.percentChange).toBeCloseTo(10);
  });

  it("uses the latest current set within the inclusive seven-day window", () => {
    const summary = summarizePerformance(
      [
        topSet("squat", "2026-06-01", 90),
        topSet("squat", "2026-06-12", 100),
        topSet("squat", "2026-06-16", 105),
        topSet("squat", "2026-06-18", 110)
      ],
      "2026-06-18"
    );

    expect(summary.items[0]?.current.date).toBe("2026-06-18");
    expect(summary.items[0]?.previous.date).toBe("2026-06-16");
  });

  it("reports repeated two-step declines but not a one-off decline", () => {
    const summary = summarizePerformance(
      [
        topSet("repeated", "2026-06-01", 100),
        topSet("repeated", "2026-06-10", 98),
        topSet("repeated", "2026-06-18", 96),
        topSet("one-off", "2026-06-01", 100),
        topSet("one-off", "2026-06-10", 102),
        topSet("one-off", "2026-06-18", 100)
      ],
      "2026-06-18"
    );

    expect(summary.repeatedDeclineExerciseIds).toEqual(["repeated"]);
  });

  it("tolerates unordered input and includes the window start date", () => {
    const summary = summarizePerformance(
      [
        topSet("squat", "2026-06-12", 100),
        topSet("squat", "2026-06-01", 90)
      ],
      "2026-06-18"
    );

    expect(summary.items[0]?.current.date).toBe("2026-06-12");
    expect(summary.items[0]?.previous.date).toBe("2026-06-01");
  });

  it("throws for an invalid end date through the strict date helper", () => {
    expect(() =>
      summarizePerformance([], "2026-02-30" as LocalDate)
    ).toThrow(
      'Invalid local date "2026-02-30": expected a real calendar date in YYYY-MM-DD format'
    );
  });
});
