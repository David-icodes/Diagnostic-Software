/** Existing test state: saved results mean CLOSED (Sample Collection / Lab Summary). */
export function billCompletion(
  bills: { id: string; patientId: string; testIds: string[] }[],
  results: { billId: string; patientId: string; testId: string; parameterId: string; result: unknown }[],
): Map<string, boolean> {
  const saved = new Map<string, Set<string>>();
  for (const result of results) {
    if (result.result === undefined || result.result === null ||
      (typeof result.result === "string" && !result.result.trim()) ||
      (typeof result.result === "number" && !Number.isFinite(result.result))) continue;
    const key = `${result.billId}|${result.patientId}|${result.testId}`;
    const ids = saved.get(key) ?? new Set<string>();
    ids.add(result.parameterId);
    saved.set(key, ids);
  }
  return new Map(bills.map((bill) => [bill.id, bill.testIds.length > 0 &&
    bill.testIds.every((testId) => {
      const entered = saved.get(`${bill.id}|${bill.patientId}|${testId}`);
      // No saved result means OPEN. A bill without ordered tests stays pending.
      return Boolean(entered?.size);
    })]));
}
