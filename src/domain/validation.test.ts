import { describe, expect, it } from "vitest";
import { makeDailyEntry, makeTopSet } from "../test/fixtures";
import { validateDailyEntry, validateTopSet } from "./validation";

describe("validateDailyEntry", () => {
  it("returns all invalid daily-entry messages in field order", () => {
    expect(
      validateDailyEntry(
        makeDailyEntry({
          date: "2026-06-19",
          weightKg: 0,
          waistCm: 400,
          calories: -1,
          sleepScore: 11
        })
      )
    ).toEqual([
      "Váha musí byť medzi 30 a 300 kg.",
      "Pás musí byť medzi 40 a 250 cm.",
      "Kalórie musia byť medzi 0 a 10 000.",
      "Spánok musí byť na škále 1–10."
    ]);
  });

  it("accepts omitted optional values", () => {
    expect(validateDailyEntry(makeDailyEntry())).toEqual([]);
  });

  it.each([
    {
      weightKg: 30,
      waistCm: 40,
      calories: 0,
      sleepScore: 1,
      readinessScore: 1,
      trainingQualityScore: 1
    },
    {
      weightKg: 300,
      waistCm: 250,
      calories: 10_000,
      sleepScore: 10,
      readinessScore: 10,
      trainingQualityScore: 10
    },
    {
      weightKg: 81.4,
      waistCm: 84.5,
      calories: 2900,
      sleepScore: 7,
      readinessScore: 8,
      trainingQualityScore: 9
    }
  ])("accepts valid daily values %#", (values) => {
    expect(validateDailyEntry(makeDailyEntry(values))).toEqual([]);
  });

  it("validates all three optional scores independently", () => {
    expect(
      validateDailyEntry(
        makeDailyEntry({
          sleepScore: 0,
          readinessScore: 11,
          trainingQualityScore: 0
        })
      )
    ).toEqual([
      "Spánok musí byť na škále 1–10.",
      "Pripravenosť musí byť na škále 1–10.",
      "Kvalita tréningu musí byť na škále 1–10."
    ]);
  });
});

describe("validateTopSet", () => {
  it("rejects non-positive weight, decimal reps, and out-of-range RIR", () => {
    expect(
      validateTopSet(
        makeTopSet({
          weightKg: 0,
          reps: 1.5,
          rir: -1
        })
      )
    ).toEqual([
      "Top set: Váha musí byť väčšia ako 0 kg.",
      "Opakovania musia byť 1–100.",
      "RIR musí byť 0–10."
    ]);
  });

  it("rejects values above the upper bounds", () => {
    expect(
      validateTopSet(
        makeTopSet({
          weightKg: 1000.1,
          reps: 101,
          rir: 10.1
        })
      )
    ).toEqual([
      "Top set: Váha musí byť väčšia ako 0 kg.",
      "Opakovania musia byť 1–100.",
      "RIR musí byť 0–10."
    ]);
  });

  it.each([
    { weightKg: 0.1, reps: 1, rir: 0 },
    { weightKg: 1000, reps: 100, rir: 10 }
  ])("accepts valid top-set boundaries %#", (values) => {
    expect(validateTopSet(makeTopSet(values))).toEqual([]);
  });
});
