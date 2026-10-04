import type { FilterQuery } from "mongoose";
import { isValidObjectId } from "../../../utils/object-id";
import {
  DATE_ONLY_REGEX,
  localDayRange,
  parseLocalDayStart,
} from "../../../utils/date-range";

export { DATE_ONLY_REGEX };

/** Cap applied to `export` requests so a full report can fit in one response. */
export const EXPORT_LIMIT = 1000;

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Parses a `YYYY-MM-DD` query value into a `Date` at the start of that **local**
 * calendar day. Local, not UTC: a date-only business value must not shift to the
 * previous day for records created before the local UTC offset.
 */
export function parseStartOfDay(value: string | undefined): Date | undefined {
  return parseLocalDayStart(value);
}

export interface DayRange {
  $gte?: Date;
  $lt?: Date;
}

/**
 * Builds an inclusive `from` / exclusive `to`+1day range for the report's
 * `fromDate` / `toDate` query values, using local calendar days. Returns
 * `undefined` when neither is set.
 */
export function dayRange(fromDate: string | undefined, toDate: string | undefined): DayRange | undefined {
  return localDayRange(fromDate, toDate);
}

/**
 * Splits a comma-separated query value into a trimmed, non-empty string list.
 */
export function splitCsv(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const parts = value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}

export function allValidIds(ids: string[]): boolean {
  return ids.every(isValidObjectId);
}

export interface ReportPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Standard pagination helper for report rows. When `isExport` is set the page/
 * skip logic is bypassed and the report returns up to EXPORT_LIMIT rows so the
 * printed/exported report carries the whole filtered result.
 */
export function slicePage<T>(
  rows: T[],
  total: number,
  page: number,
  limit: number,
  isExport: boolean,
): { data: T[]; pagination: ReportPaginationMeta } {
  const safePage = Math.max(1, Math.floor(page));
  const cap = isExport ? EXPORT_LIMIT : 100;
  const safeLimit = Math.min(cap, Math.max(1, Math.floor(limit)));
  const skip = isExport ? 0 : (safePage - 1) * safeLimit;
  const data = isExport ? rows.slice(0, EXPORT_LIMIT) : rows.slice(skip, skip + safeLimit);
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));
  return {
    data,
    pagination: { page: safePage, limit: safeLimit, total, totalPages },
  };
}

export function emptyPagination(page: number, limit: number) {
  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
  return { page: safePage, limit: safeLimit, total: 0, totalPages: 0 };
}

export type BillFilter = FilterQuery<unknown>;