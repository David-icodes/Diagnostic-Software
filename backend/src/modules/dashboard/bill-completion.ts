import { persistedSubmission } from "../test-results/result-workflow.service";

type OrderedBill = { id: string; patientId: string; testIds: string[]; collectionIds?: Record<string, string> };
type SavedResult = { id?: string; billId: string; patientId: string; testId: string; parameterId: string;
  result: unknown; version: number; enteredAt: Date; collectionId?: string; superseded?: boolean };
type SubmissionEvent = { entity: string; action: string };

/** Same submitted-result rule as report eligibility, grouped by current ordered test.
 * Events are newest first, as returned by the audit query. Empty bills stay pending.
 * A submitted test may intentionally contain a subset of parameters; no new
 * clinical completeness requirement is inferred from today's parameter catalogue.
 */
export function billCompletion(bills: OrderedBill[], results: SavedResult[], events: SubmissionEvent[] = []): Map<string, boolean> {
  const saved = new Map<string, SavedResult[]>();
  for (const result of results) {
    if (result.superseded) continue;
    const key = `${result.billId}|${result.patientId}|${result.testId}`;
    const rows = saved.get(key) ?? [];
    rows.push(result);
    saved.set(key, rows);
  }
  return new Map(bills.map(bill => [bill.id, bill.testIds.length > 0 &&
    [...new Set(bill.testIds)].every(testId => {
      const rows = (saved.get(`${bill.id}|${bill.patientId}|${testId}`) ?? []).filter(row =>
        (row.collectionId ?? "") === (bill.collectionIds?.[testId] ?? ""));
      const ids = new Set(rows.map(row => row.id));
      const latest = events.find(event => ids.has(event.entity));
      return persistedSubmission(rows, latest?.action);
    })]));
}

/** @deprecated Compatibility name: the dashboard counts pending bills, not tests. */
export function pendingTestCount(bills: OrderedBill[], results: SavedResult[], events: SubmissionEvent[] = []): number {
  return [...billCompletion(bills, results, events).values()].filter(complete => !complete).length;
}
