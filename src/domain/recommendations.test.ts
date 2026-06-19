import { describe, expect, it } from "vitest";
import {
  evaluateRecommendation,
  type RecommendationMetrics
} from "./recommendations";

const WEIGHT_MESSAGE =
  "Potrebných je aspoň 5 vážení v každom porovnávanom týždni.";
const CALORIE_DAYS_MESSAGE =
  "Potrebných je aspoň 10 dní so zapísanými kalóriami.";
const WAIST_DAYS_MESSAGE = "Potrebné sú aspoň 4 merania pásu za 14 dní.";
const CALORIE_ADHERENCE_MESSAGE =
  "Priemerná odchýlka od kalorického cieľa je vyššia než 10 %.";
const INVALID_METRICS_MESSAGE =
  "Vstupné metriky obsahujú neplatné alebo protichodné hodnoty.";
const MISSING_PERFORMANCE_MESSAGE =
  "Na zvýšenie kalórií je potrebný aspoň jeden porovnateľný hlavný cvik.";

function metrics(
  overrides: Partial<RecommendationMetrics> = {}
): RecommendationMetrics {
  return {
    validWeightsWeek1: 7,
    validWeightsWeek2: 7,
    calorieDays: 14,
    waistDays: 4,
    calorieMeanAbsoluteErrorPct: 5,
    weeklyWeightChangePct: 0.3,
    weeklyWeightChangeKg: 0.25,
    waistChangeCm: 0.2,
    performancePercent: 1,
    repeatedExerciseDecline: false,
    averageSleep: null,
    averageReadiness: null,
    averageTrainingQuality: null,
    ...overrides
  };
}

function expectHardGuard(
  result: ReturnType<typeof evaluateRecommendation>,
  missingData: string[],
  reasonCodes: string[] = []
) {
  expect(result).toEqual({
    status: "insufficient",
    action: "none",
    calorieDeltaTraining: 0,
    calorieDeltaRest: 0,
    confidence: "low",
    reasonCodes,
    missingData
  });
}

describe("evaluateRecommendation hard guards", () => {
  it.each([
    ["first week", { validWeightsWeek1: 4 }],
    ["second week", { validWeightsWeek2: 4 }]
  ])("requires five weights in the %s", (_, override) => {
    expectHardGuard(
      evaluateRecommendation(metrics(override)),
      [WEIGHT_MESSAGE]
    );
  });

  it("requires ten calorie days", () => {
    expectHardGuard(
      evaluateRecommendation(metrics({ calorieDays: 9 })),
      [CALORIE_DAYS_MESSAGE]
    );
  });

  it("requires four waist measurements", () => {
    expectHardGuard(
      evaluateRecommendation(metrics({ waistDays: 3 })),
      [WAIST_DAYS_MESSAGE]
    );
  });

  it("rejects calorie error above ten percent", () => {
    expectHardGuard(
      evaluateRecommendation(
        metrics({ calorieMeanAbsoluteErrorPct: 10.01 })
      ),
      [CALORIE_ADHERENCE_MESSAGE],
      ["LOW_CALORIE_ADHERENCE"]
    );
  });

  it("gives invalid metrics precedence over data sufficiency guards", () => {
    expectHardGuard(
      evaluateRecommendation(
        metrics({
          validWeightsWeek1: 4,
          validWeightsWeek2: 3,
          calorieDays: 9,
          waistDays: 3,
          calorieMeanAbsoluteErrorPct: 11,
          weeklyWeightChangeKg: Number.POSITIVE_INFINITY
        })
      ),
      [INVALID_METRICS_MESSAGE],
      ["INVALID_METRICS"]
    );
  });

  it("accepts every hard-guard threshold exactly", () => {
    const result = evaluateRecommendation(
      metrics({
        validWeightsWeek1: 5,
        validWeightsWeek2: 5,
        calorieDays: 10,
        waistDays: 4,
        calorieMeanAbsoluteErrorPct: 10
      })
    );

    expect(result.status).toBe("hold");
    expect(result.missingData).toEqual([]);
  });
});

describe("evaluateRecommendation invalid metric domains", () => {
  it.each([
    ["validWeightsWeek1", -1],
    ["validWeightsWeek1", 1.5],
    ["validWeightsWeek1", 8],
    ["validWeightsWeek2", -1],
    ["validWeightsWeek2", 1.5],
    ["validWeightsWeek2", 8],
    ["calorieDays", -1],
    ["calorieDays", 1.5],
    ["calorieDays", 15],
    ["waistDays", -1],
    ["waistDays", 1.5],
    ["waistDays", 15]
  ] satisfies Array<[keyof RecommendationMetrics, number]>)(
    "rejects invalid count domain %s=%s",
    (field, value) => {
      expectHardGuard(
        evaluateRecommendation(metrics({ [field]: value })),
        [INVALID_METRICS_MESSAGE],
        ["INVALID_METRICS"]
      );
    }
  );

  it("accepts maximum valid count boundaries", () => {
    const result = evaluateRecommendation(
      metrics({
        validWeightsWeek1: 7,
        validWeightsWeek2: 7,
        calorieDays: 14,
        waistDays: 14
      })
    );

    expect(result.status).toBe("hold");
    expect(result.reasonCodes).toEqual(["MONITOR_NEXT_BLOCK"]);
  });

  it("rejects negative calorie mean absolute error", () => {
    expectHardGuard(
      evaluateRecommendation(metrics({ calorieMeanAbsoluteErrorPct: -0.01 })),
      [INVALID_METRICS_MESSAGE],
      ["INVALID_METRICS"]
    );
  });

  it.each([
    ["averageSleep", 0],
    ["averageSleep", 11],
    ["averageReadiness", 0],
    ["averageReadiness", 11],
    ["averageTrainingQuality", 0],
    ["averageTrainingQuality", 11]
  ] satisfies Array<[keyof RecommendationMetrics, number]>)(
    "rejects subjective average outside 1..10: %s=%s",
    (field, value) => {
      expectHardGuard(
        evaluateRecommendation(metrics({ [field]: value })),
        [INVALID_METRICS_MESSAGE],
        ["INVALID_METRICS"]
      );
    }
  );

  it.each([
    "validWeightsWeek1",
    "validWeightsWeek2",
    "calorieDays",
    "waistDays",
    "calorieMeanAbsoluteErrorPct",
    "weeklyWeightChangePct",
    "weeklyWeightChangeKg",
    "waistChangeCm",
    "performancePercent",
    "averageSleep",
    "averageReadiness",
    "averageTrainingQuality"
  ] satisfies Array<keyof RecommendationMetrics>)(
    "rejects non-finite %s",
    (field) => {
      expectHardGuard(
        evaluateRecommendation(metrics({ [field]: Number.NaN })),
        [INVALID_METRICS_MESSAGE],
        ["INVALID_METRICS"]
      );
    }
  );

  it.each([
    [0.3, -0.25],
    [-0.3, 0.25]
  ])(
    "rejects contradictory non-zero weight-change signs: pct=%s kg=%s",
    (weeklyWeightChangePct, weeklyWeightChangeKg) => {
      expectHardGuard(
        evaluateRecommendation(
          metrics({ weeklyWeightChangePct, weeklyWeightChangeKg })
        ),
        [INVALID_METRICS_MESSAGE],
        ["INVALID_METRICS"]
      );
    }
  );

  it.each([
    [1e-9, -100],
    [-1e-9, 100],
    [100, -1e-9],
    [-100, 1e-9],
    [0, -100],
    [100, 0]
  ])(
    "treats an epsilon-zero weight change as non-contradictory: pct=%s kg=%s",
    (weeklyWeightChangePct, weeklyWeightChangeKg) => {
      const result = evaluateRecommendation(
        metrics({ weeklyWeightChangePct, weeklyWeightChangeKg })
      );

      expect(result.reasonCodes).not.toContain("INVALID_METRICS");
    }
  );

  it("does not impose arbitrary upper bounds on continuous metrics", () => {
    const result = evaluateRecommendation(
      metrics({
        weeklyWeightChangePct: 1_000,
        weeklyWeightChangeKg: 10_000,
        waistChangeCm: -1_000,
        performancePercent: 10_000
      })
    );

    expect(result.status).toBe("hold");
    expect(result.reasonCodes).toEqual(["MONITOR_NEXT_BLOCK"]);
  });

  it.each([
    {
      validWeightsWeek1: 8,
      weeklyWeightChangePct: 0.51,
      weeklyWeightChangeKg: 0.5,
      waistChangeCm: 0.5
    },
    {
      calorieDays: 15,
      weeklyWeightChangePct: -0.51,
      weeklyWeightChangeKg: -0.5,
      performancePercent: -0.01
    },
    {
      waistDays: 15,
      weeklyWeightChangePct: 0,
      weeklyWeightChangeKg: 0,
      performancePercent: 0
    }
  ])("never lets invalid inputs reach pending action branches", (override) => {
    expectHardGuard(
      evaluateRecommendation(metrics(override)),
      [INVALID_METRICS_MESSAGE],
      ["INVALID_METRICS"]
    );
  });
});

describe("evaluateRecommendation decisions", () => {
  it("decreases all days for fast weight gain with waist growth", () => {
    expect(
      evaluateRecommendation(
        metrics({
          weeklyWeightChangePct: 0.51,
          waistChangeCm: 0.5
        })
      )
    ).toEqual({
      status: "pending",
      action: "decrease_all",
      calorieDeltaTraining: -150,
      calorieDeltaRest: -150,
      confidence: "high",
      reasonCodes: ["FAST_WEIGHT_GAIN", "WAIST_GROWTH"],
      missingData: []
    });
  });

  it.each([
    ["weight is exactly at the boundary", 0.5, 0.5],
    ["waist growth is below the boundary", 0.51, 0.49]
  ])("does not decrease when %s", (_, weightChange, waistChange) => {
    const result = evaluateRecommendation(
      metrics({
        weeklyWeightChangePct: weightChange,
        waistChangeCm: waistChange
      })
    );

    expect(result.action).toBe("none");
    expect(result.reasonCodes).toEqual(["MONITOR_NEXT_BLOCK"]);
  });

  it.each([
    ["percentage loss", -0.51, -0.2],
    ["kilogram loss at the inclusive boundary", -0.3, -0.5]
  ])("increases all days for %s with performance decline", (_, pct, kg) => {
    expect(
      evaluateRecommendation(
        metrics({
          weeklyWeightChangePct: pct,
          weeklyWeightChangeKg: kg,
          performancePercent: -0.01
        })
      )
    ).toEqual({
      status: "pending",
      action: "increase_all",
      calorieDeltaTraining: 100,
      calorieDeltaRest: 100,
      confidence: "high",
      reasonCodes: ["FAST_WEIGHT_LOSS", "PERFORMANCE_DECLINE"],
      missingData: []
    });
  });

  it("accepts repeated exercise decline as decline when performance is present", () => {
    expect(
      evaluateRecommendation(
        metrics({
          weeklyWeightChangePct: -0.51,
          weeklyWeightChangeKg: -0.25,
          performancePercent: 0,
          repeatedExerciseDecline: true
        })
      ).action
    ).toBe("increase_all");
  });

  it.each([
    ["improving performance", 1, false],
    ["null performance despite a repeated flag", null, true]
  ])("holds rapid loss with %s", (_, performancePercent, repeatedExerciseDecline) => {
    const result = evaluateRecommendation(
      metrics({
        weeklyWeightChangePct: -0.51,
        weeklyWeightChangeKg: -0.25,
        performancePercent,
        repeatedExerciseDecline
      })
    );

    expect(result.status).toBe("hold");
    expect(result.action).toBe("none");
    expect(result.reasonCodes).toEqual(["MONITOR_NEXT_BLOCK"]);
  });

  it.each([-0.2, 0, 0.2])(
    "increases training calories for stable weight at %s percent",
    (weeklyWeightChangePct) => {
      expect(
        evaluateRecommendation(
          metrics({
            weeklyWeightChangePct,
            weeklyWeightChangeKg: weeklyWeightChangePct,
            waistChangeCm: 0.49,
            performancePercent: 0
          })
        )
      ).toEqual({
        status: "pending",
        action: "increase_training",
        calorieDeltaTraining: 100,
        calorieDeltaRest: 0,
        confidence: "high",
        reasonCodes: ["STABLE_WEIGHT", "STABLE_WAIST", "PERFORMANCE_OK"],
        missingData: []
      });
    }
  );

  it("requires comparable performance before increasing stable-weight calories", () => {
    expect(
      evaluateRecommendation(
        metrics({
          weeklyWeightChangePct: 0,
          waistChangeCm: 0.2,
          performancePercent: null
        })
      )
    ).toEqual({
      status: "insufficient",
      action: "none",
      calorieDeltaTraining: 0,
      calorieDeltaRest: 0,
      confidence: "low",
      reasonCodes: ["MISSING_PERFORMANCE"],
      missingData: [MISSING_PERFORMANCE_MESSAGE]
    });
  });

  it("holds stable weight when performance declines", () => {
    const result = evaluateRecommendation(
      metrics({
        weeklyWeightChangePct: 0,
        performancePercent: -0.01
      })
    );

    expect(result.status).toBe("hold");
    expect(result.reasonCodes).toEqual(["MONITOR_NEXT_BLOCK"]);
  });

  it("holds an ambiguous 0.3 percent weight change", () => {
    expect(evaluateRecommendation(metrics())).toEqual({
      status: "hold",
      action: "none",
      calorieDeltaTraining: 0,
      calorieDeltaRest: 0,
      confidence: "high",
      reasonCodes: ["MONITOR_NEXT_BLOCK"],
      missingData: []
    });
  });
});

describe("evaluateRecommendation confidence", () => {
  it.each([
    ["sleep", { averageSleep: 4 }],
    ["readiness", { averageReadiness: 4 }],
    ["training quality", { averageTrainingQuality: 4 }]
  ])("uses medium confidence when present %s is four or lower", (_, override) => {
    const result = evaluateRecommendation(
      metrics({
        weeklyWeightChangePct: 0.51,
        waistChangeCm: 0.5,
        ...override
      })
    );

    expect(result.action).toBe("decrease_all");
    expect(result.confidence).toBe("medium");
  });

  it("uses high confidence when subjectives are absent or above four", () => {
    const result = evaluateRecommendation(
      metrics({
        weeklyWeightChangePct: 0.51,
        waistChangeCm: 0.5,
        averageSleep: 5,
        averageReadiness: null,
        averageTrainingQuality: 8
      })
    );

    expect(result.confidence).toBe("high");
  });

  it("does not let subjective scores create an action", () => {
    const result = evaluateRecommendation(
      metrics({
        averageSleep: 1,
        averageReadiness: 1,
        averageTrainingQuality: 1
      })
    );

    expect(result.status).toBe("hold");
    expect(result.action).toBe("none");
    expect(result.confidence).toBe("medium");
  });
});
