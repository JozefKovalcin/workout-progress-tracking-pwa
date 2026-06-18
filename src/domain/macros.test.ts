import { describe, expect, it } from "vitest";
import { DEFAULT_TRAINING_DAYS } from "./defaults";
import { calculateMacros, resolveDayType } from "./macros";
import type { LocalDate } from "./types";

describe("calculateMacros", () => {
  it("calculates carbohydrate grams from the remaining calories", () => {
    expect(calculateMacros(2900, 180, 50)).toEqual({
      calories: 2900,
      proteinGrams: 180,
      carbsGrams: 432.5,
      fatGrams: 50
    });
  });
});

describe("resolveDayType", () => {
  it("uses the enabled training-day schedule", () => {
    expect(resolveDayType("2026-06-19", DEFAULT_TRAINING_DAYS)).toBe("training");
    expect(resolveDayType("2026-06-18", DEFAULT_TRAINING_DAYS)).toBe("rest");
  });

  it("gives an explicit override precedence over the schedule", () => {
    expect(resolveDayType("2026-06-19", DEFAULT_TRAINING_DAYS, "rest")).toBe("rest");
  });

  it("rejects an invalid local date through the strict date helper", () => {
    expect(() =>
      resolveDayType("2026-02-30" as LocalDate, DEFAULT_TRAINING_DAYS)
    ).toThrow(
      'Invalid local date "2026-02-30": expected a real calendar date in YYYY-MM-DD format'
    );
  });
});
