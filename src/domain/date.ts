import { format, isValid, parseISO } from "date-fns";
import type { LocalDate } from "./types";

export function toLocalDate(date: Date): LocalDate {
  return format(date, "yyyy-MM-dd") as LocalDate;
}

export function isLocalDate(value: string): value is LocalDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = parseISO(value);
  return isValid(date) && format(date, "yyyy-MM-dd") === value;
}

export function fromLocalDate(value: LocalDate): Date {
  if (!isLocalDate(value)) {
    throw new Error(
      `Invalid local date "${value}": expected a real calendar date in YYYY-MM-DD format`
    );
  }

  return parseISO(value);
}

export function weekdayIso(value: LocalDate): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  const day = fromLocalDate(value).getDay();
  return (day === 0 ? 7 : day) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
}
