/**
 * Calendar-day handling for date-only business values.
 *
 * A `YYYY-MM-DD` query value is a *local calendar day*, not an instant. Parsing
 * it as UTC midnight (`new Date("2026-10-04")`) shifts every record created
 * before the local UTC offset back to the previous day — a record created at
 * 03:00 in a +05:30 region is stored as the previous UTC day and would fall
 * outside a "today" filter. These helpers build the day boundaries from the
 * server's local calendar so the query interval matches the day the user picked.
 *
 * Storage is unchanged: timestamps remain BSON Dates (exact instants). Only the
 * day boundaries derived from a date-only value are local.
 */

export const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Local midnight at the start of a `YYYY-MM-DD` day, or undefined when invalid. */
export function parseLocalDayStart(value?: string | null): Date | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!DATE_ONLY_REGEX.test(trimmed)) return undefined;
  const [year, month, day] = trimmed.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  // The Date constructor normalises impossible dates (for example, October 32)
  // into the following month. Reject those instead of silently querying a
  // different business day.
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }
  return date;
}

export interface LocalDayRange {
  $gte?: Date;
  $lt?: Date;
}

/**
 * Inclusive `from` / exclusive `to`+1 day range covering the local calendar
 * days the user selected. The upper bound is the start of the day *after* `to`,
 * so no record on the selected day is missed and the next day is not included.
 */
export function localDayRange(
  fromDate?: string | undefined,
  toDate?: string | undefined,
): LocalDayRange | undefined {
  const from = parseLocalDayStart(fromDate);
  const to = parseLocalDayStart(toDate);
  if (!from && !to) return undefined;
  const range: LocalDayRange = {};
  if (from) range.$gte = from;
  if (to) {
    const end = new Date(to);
    end.setDate(end.getDate() + 1);
    range.$lt = end;
  }
  return range;
}

/** `YYYY-MM-DD` for a date in the local calendar. */
export function formatLocalDate(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** `dd-mm-yyyy` for a date in the local calendar. */
export function formatLocalDisplayDate(date: Date = new Date()): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}-${month}-${date.getFullYear()}`;
}
