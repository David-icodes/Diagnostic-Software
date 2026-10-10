/** India business-calendar query boundaries. BSON timestamps are unchanged. */
import { businessDateInput, businessDayStart } from "./business-date";

export const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Local midnight at the start of a `YYYY-MM-DD` day, or undefined when invalid. */
export const parseLocalDayStart = businessDayStart;

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
    end.setTime(end.getTime() + 24 * 60 * 60 * 1000);
    range.$lt = end;
  }
  return range;
}

/** `YYYY-MM-DD` for a date in the local calendar. */
export const formatLocalDate = businessDateInput;

/** `dd-mm-yyyy` for a date in the local calendar. */
export function formatLocalDisplayDate(date: Date = new Date()): string { const [year,month,day]=businessDateInput(date).split("-"); return `${day}-${month}-${year}`; }
