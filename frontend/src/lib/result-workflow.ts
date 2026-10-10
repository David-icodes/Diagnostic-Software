import type { ResultWorkflow } from "../types/test-result.ts";

export type ResultPrintMode = "continuous" | "department" | "test";

/** No typed values or selected-row state can confer submission eligibility. */
export function submittedForTest(workflow: ResultWorkflow | undefined, billId: string | undefined, testId: string): boolean {
  return Boolean(billId && workflow?.billId === billId && workflow.tests.some((row) => row.testId === testId && row.submitted));
}

export function requireReportEligibility(workflow: ResultWorkflow, billId: string, patientId: string, testIds: string[]): void {
  if (workflow.billId !== billId || workflow.patientId !== patientId) throw new Error("The report does not belong to the selected patient and bill.");
  if (!testIds.length || testIds.some((id) => !submittedForTest(workflow, billId, id))) throw new Error("Submit the selected test results successfully before printing.");
  if (!Number.isFinite(workflow.outstandingDue) || workflow.outstandingDue < 0) throw new Error("Patient outstanding due could not be verified.");
  if (workflow.hasOutstandingDue || workflow.outstandingDue > 0) throw new Error("This patient has an outstanding due. Report generation is not allowed.");
}

/** Keep bill order; insert breaks only at observed print-mode boundaries. */
export function reportStartsPage(mode: ResultPrintMode, index: number, department: string, previousDepartment?: string): boolean {
  return index > 0 && (mode === "test" || (mode === "department" && department !== previousDepartment));
}
