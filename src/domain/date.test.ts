import { describe, expect, it } from "vitest";
import * as dates from "./date";
import { fromLocalDate, isLocalDate, weekdayIso } from "./date";
import type { LocalDate } from "./types";

describe("local date validation", () => {
  it("accepts valid calendar dates including leap days", () => {
    expect(isLocalDate("2024-02-29")).toBe(true);
    expect(fromLocalDate("2024-02-29")).toEqual(new Date(2024, 1, 29));
    expect(weekdayIso("2024-02-29")).toBe(4);
  });

  it.each([
    "2026-6-19",
    "2026-02-30",
    "2026-00-10",
    "2026-13-01",
    "not-a-date"
  ])("rejects malformed or impossible date %s", (value) => {
    expect(isLocalDate(value)).toBe(false);
    expect(() => fromLocalDate(value as LocalDate)).toThrow(
      `Invalid local date "${value}": expected a real calendar date in YYYY-MM-DD format`
    );
  });

  it("formats local dates for display as DD/MM/YYYY", () => {
    expect(
      (dates as { formatDisplayDate?: (value: LocalDate) => string })
        .formatDisplayDate?.("2026-06-09")
    ).toBe("09/06/2026");
  });
});
