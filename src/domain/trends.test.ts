import { describe, expect, it } from "vitest";
import {
  classifyCalorieAdherence,
  classifyCalorieAdherenceTrend,
  classifyStrengthTrend,
  classifyWaistTrend,
  classifyWeightTrend
} from "./trends";

describe("semantic trend classification", () => {
  it("treats strength changes by training meaning", () => {
    expect(classifyStrengthTrend(2.4)).toMatchObject({
      tone: "positive",
      className: "trend-positive",
      badge: "zlepšenie"
    });
    expect(classifyStrengthTrend(-0.4)).toMatchObject({
      tone: "negative",
      className: "trend-negative",
      badge: "pokles"
    });
    expect(classifyStrengthTrend(0)).toMatchObject({
      tone: "neutral",
      className: "trend-neutral",
      badge: "bez zmeny"
    });
  });

  it("classifies weight gain by lean-bulk target range instead of sign", () => {
    expect(classifyWeightTrend({
      weeklyChangePct: 0.25,
      targetGainMinPct: 0.2,
      targetGainMaxPct: 0.35
    })).toMatchObject({
      tone: "positive",
      className: "trend-positive",
      badge: "zlepšenie"
    });

    expect(classifyWeightTrend({
      weeklyChangePct: 0.7,
      targetGainMinPct: 0.2,
      targetGainMaxPct: 0.35
    })).toMatchObject({
      tone: "negative",
      className: "trend-negative",
      badge: "pokles"
    });

    expect(classifyWeightTrend({
      weeklyChangePct: -0.1,
      targetGainMinPct: 0.2,
      targetGainMaxPct: 0.35
    })).toMatchObject({
      tone: "negative",
      className: "trend-negative",
      badge: "pokles"
    });
  });

  it("keeps insufficient weight data neutral", () => {
    expect(classifyWeightTrend({
      weeklyChangePct: Number.NaN,
      targetGainMinPct: 0.2,
      targetGainMaxPct: 0.35
    })).toMatchObject({
      tone: "neutral",
      className: "trend-neutral",
      badge: "málo dát"
    });
  });

  it("marks waist increases as risky and decreases as good", () => {
    expect(classifyWaistTrend(0.6)).toMatchObject({
      tone: "negative",
      className: "trend-negative",
      badge: "pokles"
    });
    expect(classifyWaistTrend(-0.4)).toMatchObject({
      tone: "positive",
      className: "trend-positive",
      badge: "zlepšenie"
    });
  });

  it("marks calorie adherence by closeness to target", () => {
    expect(classifyCalorieAdherence(6)).toMatchObject({
      tone: "positive",
      className: "status-good",
      badge: "zlepšenie"
    });
    expect(classifyCalorieAdherence(12)).toMatchObject({
      tone: "negative",
      className: "status-danger",
      badge: "pokles"
    });
    expect(classifyCalorieAdherenceTrend(4, 8)).toMatchObject({
      tone: "positive",
      className: "trend-positive",
      badge: "zlepšenie"
    });
  });
});
