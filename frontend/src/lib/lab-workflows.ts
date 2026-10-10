/** Transfer exactly one current option, retaining IDs and preventing duplicates. */
export function selectedTransfer<T extends { id: string }>(tests: T[], selectedId: string | null, addedIds: Set<string>): T | undefined {
  return tests.find((test) => test.id === selectedId && !addedIds.has(test.id));
}

/** Only ordered, explicitly selected tests may be included in a report. */
export function orderedPrintIds(items: { testId: string }[], marked: Record<string, boolean>): string[] {
  return [...new Set(items.filter((item) => marked[item.testId]).map((item) => item.testId))];
}

export function hasEnteredResult(value: unknown): boolean {
  return value !== undefined && value !== null && (typeof value !== "string" || value.trim() !== "");
}

export function sampleIsCollected(status?: string): boolean {
  return ["COLLECTED", "RECOLLECTED", "RECEIVED", "PROCESSED"].includes(status ?? "");
}

export interface SampleContext {
  billId: string; testId: string; billNumber: string; sampleId?: string;
  returnFilters?: { mode: "today" | "criteria"; fromDate: string; toDate: string; billNumber?: string; patientName: string; includeClients: boolean };
}
function contextQuery(context: SampleContext): URLSearchParams {
  const query = new URLSearchParams({ billId: context.billId, testId: context.testId, billNumber: context.billNumber });
  if (context.sampleId) query.set("sampleId", context.sampleId);
  if (context.returnFilters) {
    query.set("resultMode", context.returnFilters.mode);
    query.set("resultFromDate", context.returnFilters.fromDate);
    query.set("resultToDate", context.returnFilters.toDate);
    if (context.returnFilters.billNumber !== undefined) query.set("resultBillNumber", context.returnFilters.billNumber);
    query.set("resultPatientName", context.returnFilters.patientName);
    query.set("resultIncludeClients", String(context.returnFilters.includeClients));
  }
  return query;
}
export function sampleContextHref(context: SampleContext): string {
  return `/laboratory/test-result/sample-collections?${contextQuery(context)}`;
}
/** Fixed local destination; never accept an arbitrary return URL. */
export function resultContextHref(context: SampleContext): string {
  return `/laboratory/test-result/parameter-based-test-results?${contextQuery(context)}`;
}
export function sampleContextFromQuery(query: Record<string, string | string[] | undefined>): SampleContext | undefined {
  const value = (key: string) => typeof query[key] === "string" ? query[key] as string : "";
  if (!value("billId") || !value("testId") || !value("billNumber")) return undefined;
  const date = (key: string) => /^\d{4}-\d{2}-\d{2}$/.test(value(key)) ? value(key) : "";
  return {
    billId: value("billId"), testId: value("testId"), billNumber: value("billNumber"), sampleId: value("sampleId") || undefined,
    returnFilters: { mode: value("resultMode") === "today" ? "today" : "criteria", fromDate: date("resultFromDate"), toDate: date("resultToDate"),
      ...(typeof query.resultBillNumber === "string" ? { billNumber: query.resultBillNumber } : {}),
      patientName: value("resultPatientName"), includeClients: value("resultIncludeClients") === "true" },
  };
}

export function matchesSampleContext(row: { billId: string; testId: string; id: string }, context?: SampleContext): boolean {
  return !context || (row.billId === context.billId && row.testId === context.testId && (!context.sampleId || row.id === context.sampleId));
}

/** Uppercase OSP display must not incidentally rewrite a registered name. */
export function patientNameForUpdate(entered: { firstName: string; lastName?: string }, existing: { firstName: string; lastName?: string }, displayNameUnchanged: boolean): { firstName: string; lastName: string } {
  const source = displayNameUnchanged ? existing : entered;
  return { firstName: source.firstName, lastName: source.lastName ?? "" };
}
