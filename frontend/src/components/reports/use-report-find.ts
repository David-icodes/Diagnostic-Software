"use client";

import { useMemo, useState } from "react";

function containsMatch(keyword: string, values: string[]): boolean {
  const needle = keyword.trim().toLowerCase();
  if (!needle) return true;
  return values.some((value) => value.toLowerCase().includes(needle));
}

export interface ReportFindControls<T> {
  findValue: string;
  onFindChange: (value: string) => void;
  matches: number;
  onFindNext: () => void;
  /** True when a row is part of the current find match set. */
  isMatch: (row: T) => boolean;
  /** True for the row currently focused for scrolling/cycling. */
  isFocused: (row: T) => boolean;
}

/**
 * Client-side "Find" over the currently loaded page of rows. The focus cycles
 * through the matches; "Next" scrolls the focused row into view. The focus is
 * tracked by row id so it is stable across data refreshes without effects.
 */
export function useReportFind<T>(
  rows: T[],
  fields: (row: T) => string[],
): ReportFindControls<T> {
  const [findValue, setFindValue] = useState("");
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const matches = useMemo(
    () =>
      findValue.trim()
        ? rows.filter((row) => containsMatch(findValue, fields(row)))
        : [],
    [rows, findValue, fields],
  );

  const focusedRow = useMemo(
    () =>
      matches.length > 0
        ? (matches.find((row) => (row as { id?: string }).id === focusedId) ??
          matches[0])
        : undefined,
    [matches, focusedId],
  );

  const onFindNext = () => {
    if (matches.length === 0) return;
    const currentIndex = matches.findIndex(
      (row) => (row as { id?: string }).id === focusedId,
    );
    const start = currentIndex < 0 ? 0 : (currentIndex + 1) % matches.length;
    const next = matches[start] as { id?: string };
    const nextId = next?.id;
    if (nextId) {
      setFocusedId(nextId);
      requestAnimationFrame(() => {
        document
          .getElementById(nextId)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  };

  const onFindChange = (value: string) => {
    setFindValue(value);
    setFocusedId(null);
  };

  const focusedRowId = (focusedRow as { id?: string } | undefined)?.id;

  return {
    findValue,
    onFindChange,
    matches: matches.length,
    onFindNext,
    isMatch: (row) => matches.includes(row),
    isFocused: (row) =>
      (row as { id?: string }).id !== undefined &&
      (row as { id?: string }).id === focusedRowId,
  };
}