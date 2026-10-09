import { Types } from "mongoose";
import { LabBill } from "../../models/lab-bill.model";
import { LabTestResult } from "../../models/lab-test-result.model";
import { AuditLog } from "../../models/audit-log.model";
import { ApiError } from "../../utils/api-error";

export const SUBMISSION_PENDING = "test_result.submission_pending";
export const SUBMISSION_CONFIRMED = "test_result.submission_confirmed";
export const PATIENT_DUE_MESSAGE = "This patient has an outstanding due. Report generation is not allowed.";

/** Existing records are submitted unless a newer tracked attempt is incomplete. */
export function persistedSubmission(
  results: Array<{ result: unknown; version: number; enteredAt: Date }>,
  latestAction?: string,
): boolean {
  return latestAction !== SUBMISSION_PENDING && results.some((row) =>
    row.version >= 1 && Number.isFinite(new Date(row.enteredAt).getTime()) &&
    (typeof row.result === "boolean" ||
      (typeof row.result === "number" && Number.isFinite(row.result)) ||
      (typeof row.result === "string" && Boolean(row.result.trim()))));
}

export async function getResultWorkflow(billId: string) {
  if (!Types.ObjectId.isValid(billId)) throw new ApiError(400, "Invalid bill ID");
  const bill = await LabBill.findById(billId).exec();
  if (!bill) throw new ApiError(404, "Bill not found");
  if (bill.status !== "generated") throw new ApiError(422, "Reports require a generated, non-cancelled bill");
  const results = await LabTestResult.find({ billId: bill._id, patientId: bill.patientId }).exec();
  const due = bill.dueAmount;
  if (!Number.isFinite(due) || due < 0) {
    throw new ApiError(422, "Bill outstanding due could not be verified. Report generation is not allowed.");
  }
  const confirmations = results.length ? await AuditLog.find({
    entityType: "LabTestResult", entity: { $in: results.map((row) => row._id) },
    action: { $in: [SUBMISSION_PENDING, SUBMISSION_CONFIRMED] },
  }).sort({ timestamp: -1, _id: -1 }).exec() : [];
  const tests = [...new Set(bill.items.map((item) => String(item.testId)))].map((testId) => {
    const saved = results.filter((row) => String(row.testId) === testId);
    const savedIds = new Set(saved.map((row) => String(row._id)));
    const latest = confirmations.find((row) => savedIds.has(String(row.entity)));
    return { testId, submitted: persistedSubmission(saved, latest?.action) };
  });
  return { billId: String(bill._id), patientId: String(bill.patientId),
    outstandingDue: Math.round(due * 100) / 100, hasOutstandingDue: due > 0, tests };
}

/** Recheck from storage for every generation/print attempt, independent of UI flags. */
export async function assertResultReportAllowed(billId: string, testIds: string[], restrictDue = true) {
  if (!testIds.length || testIds.some((id) => !Types.ObjectId.isValid(id))) {
    throw new ApiError(400, "Select submitted tests to print");
  }
  const workflow = await getResultWorkflow(billId);
  if (testIds.some((id) => !workflow.tests.some((test) => test.testId === id && test.submitted))) {
    throw new ApiError(422, "Submit the selected test results successfully before printing.");
  }
  if (restrictDue && workflow.hasOutstandingDue) throw new ApiError(422, PATIENT_DUE_MESSAGE);
  return workflow;
}
