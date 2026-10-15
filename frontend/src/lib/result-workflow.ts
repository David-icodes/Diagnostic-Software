import type { ResultWorkflow } from "../types/test-result.ts";

export type ResultPrintMode = "continuous" | "department" | "test";

/** No typed values or selected-row state can confer submission eligibility. */
export function submittedForTest(workflow: ResultWorkflow | undefined, billId: string | undefined, testId: string): boolean {
  return Boolean(billId && workflow?.billId === billId && workflow.tests.some((row) => row.testId === testId && row.submitted));
}

/** External source readiness never fabricates an in-house submitted flag. */
export function printableForTest(workflow:ResultWorkflow|undefined,billId:string|undefined,testId:string):boolean {
  return Boolean(billId && workflow?.billId===billId && workflow.tests.some(row=>row.testId===testId && (row.submitted || row.uploadedReportId)));
}

export function requireReportEligibility(workflow: ResultWorkflow, billId: string, patientId: string, testIds: string[]): void {
  if (workflow.billId !== billId || workflow.patientId !== patientId) throw new Error("The report does not belong to the selected patient and bill.");
  if (!testIds.length || testIds.some((id) => !printableForTest(workflow, billId, id))) throw new Error("Submit the selected test results successfully before printing.");
  if (!Number.isFinite(workflow.outstandingDue) || workflow.outstandingDue < 0) throw new Error("Patient outstanding due could not be verified.");
  if (workflow.hasOutstandingDue || workflow.outstandingDue > 0) throw new Error("This patient has an outstanding due. Report generation is not allowed.");
}

/** An old preview stays stale even after the replacement collection is submitted. */
export function requireReportCollections(workflow: ResultWorkflow, reports: Array<{testId:string;collectionId?:string}>): void {
  for (const report of reports) {
    const current=workflow.tests.find(test=>test.testId===report.testId);
    if(!current || (current.collectionId??"")!==(report.collectionId??""))throw new Error("The sample collection changed. Generate a fresh report before printing.");
  }
}

/** Keep bill order; insert breaks only at observed print-mode boundaries. */
export function reportStartsPage(mode: ResultPrintMode, index: number, department: string, previousDepartment?: string): boolean {
  return index > 0 && (mode === "test" || (mode === "department" && department !== previousDepartment));
}
