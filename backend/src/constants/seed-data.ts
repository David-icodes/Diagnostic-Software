/**
 * Markers for synthetic seed/trial data.
 *
 * The seed scripts label demo bills with a `DEMO` bill-number prefix (see
 * `backend/src/scripts/seedDemoBills.ts`, which is idempotent by checking
 * `billNumber: /^DEMO/`). The prefix is the only reliable way to tell a seeded
 * row apart from a genuine registration's history, so destructive actions use
 * it to refuse to touch real clinical or financial records.
 */

/** Bill numbers produced by the demo seed script. */
export const SEED_BILL_NUMBER_PREFIX = "DEMO";

/** Matches a bill number created by the demo seed script. */
export const SEED_BILL_NUMBER_PATTERN = /^DEMO/i;
