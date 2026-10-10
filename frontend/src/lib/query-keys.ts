/**
 * Central TanStack Query cache roots.
 *
 * Every read in the app is registered under one of these roots so a mutation can
 * invalidate everything it affects. Several screens previously used different
 * roots for the same data (for example `result-entry-samples` and
 * `reprint-samples` both fetched `fetchLabSamples`), which made prefix
 * invalidation miss them; those keys are now registered under a single root.
 */

import type { QueryClient } from "@tanstack/react-query";

export const queryKeys = {
  /** Patient registry, OSP search and patient pickers. */
  patients: ["patients"] as const,
  /** Bill lists (result entry, reprint, modify) and the OSP bill detail view. */
  labBills: ["lab-bills"] as const,
  /** Sample collection rows, whichever screen displays them. */
  labSamples: ["lab-samples"] as const,
  /** Parameter master list plus the entry / reprint parameter lookups. */
  labTestParameters: ["lab-test-parameters"] as const,
  /** Saved parameter results for a bill + test pair. */
  testResults: ["test-results"] as const,
  /** Dashboard summary counters. */
  dashboard: ["dashboard"] as const,
  /** Lab test master and department-filtered test lookups. */
  labTests: ["lab-tests"] as const,
  /** Referring / billing doctor lookups. */
  doctors: ["doctors"] as const,
} as const;

export type QueryRoot = (typeof queryKeys)[keyof typeof queryKeys];

/**
 * Invalidates every read that a mutation can affect.
 *
 * Pass only the roots the mutation actually touches so unrelated panels keep
 * their cache and do not refetch.
 */
export async function invalidateRoots(
  queryClient: QueryClient,
  ...roots: QueryRoot[]
): Promise<void> {
  await Promise.all(
    roots.map((root) => queryClient.invalidateQueries({ queryKey: root })),
  );
}