export const SAMPLE_TRANSITIONS: Record<string, readonly string[]> = {
 SELECT: ["COLLECTED", "REJECTED"], COLLECTED: ["RECEIVED", "RECOLLECTED", "REJECTED"],
 RECEIVED: ["PROCESSED", "RECOLLECTED", "REJECTED"], PROCESSED: ["RECOLLECTED"],
 RECOLLECTED: ["COLLECTED", "RECEIVED", "REJECTED"], REJECTED: ["RECOLLECTED", "COLLECTED"],
};
export function isSampleTransitionAllowed(current: string, next: string) { return current !== next && (SAMPLE_TRANSITIONS[current] ?? []).includes(next); }
