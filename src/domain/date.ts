import { format, parseISO } from "date-fns";
import type { LocalDate } from "./types";

export function toLocalDate(date: Date): LocalDate {
  return format(date, "yyyy-MM-dd") as LocalDate;
}

export function fromLocalDate(value: LocalDate): Date {
  return parseISO(value);
}

export function weekdayIso(value: LocalDate): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  const day = fromLocalDate(value).getDay();
  return (day === 0 ? 7 : day) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
}
