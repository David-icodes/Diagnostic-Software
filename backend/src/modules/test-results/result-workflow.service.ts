import {currentCollectionResult} from "../../utils/current-collection-result";
import { newestReportUpload } from "./report-upload-order";
import { Types } from "mongoose";
import { LabBill } from "../../models/lab-bill.model";
import { LabTestResult } from "../../models/lab-test-result.model";
import { LabReportUpload } from "../../models/lab-report-upload.model";
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

export function verifiedOutstandingDue(bill: { dueAmount: number; netAmount?: number; paidAmount?: number }) {
 if(!Number.isFinite(bill.dueAmount)||bill.dueAmount<0)throw new ApiError(422,"Bill outstanding due could not be verified. Document generation is not allowed.");
 if(bill.netAmount===undefined&&bill.paidAmount===undefined)return bill.dueAmount;
 if(!Number.isFinite(bill.netAmount)||!Number.isFinite(bill.paidAmount)||bill.netAmount!<0||bill.paidAmount!<0)throw new ApiError(422,"Bill balance could not be verified.");
 return Math.max(bill.dueAmount,Math.round(Math.max(0,bill.netAmount!-bill.paidAmount!)*100)/100);
}
export async function assertBillDocumentAllowed(billId:string) {
 if(!Types.ObjectId.isValid(billId))throw new ApiError(400,"Invalid bill ID");
 const bill=await LabBill.findById(billId).exec();if(!bill)throw new ApiError(404,"Bill not found");
 if(bill.status!=="generated")throw new ApiError(422,"Documents require a generated, non-cancelled bill");
 const due=verifiedOutstandingDue(bill);if(due>0)throw new ApiError(422,"This bill has an outstanding due. Settle dues before generating or releasing a report or invoice.");
 return {billId:String(bill._id),patientId:String(bill.patientId),outstandingDue:due};
}
/** An invoice documents the balance; it is not a clinical report release. */
export async function assertInvoicePrintAllowed(billId: string) {
  if (!Types.ObjectId.isValid(billId)) throw new ApiError(400, "Invalid bill ID");
  const bill = await LabBill.findById(billId).exec();
  if (!bill) throw new ApiError(404, "Bill not found");
  if (bill.status !== "generated") throw new ApiError(422, "Invoices require a generated, non-cancelled bill");
  return { billId: String(bill._id), patientId: String(bill.patientId), outstandingDue: verifiedOutstandingDue(bill) };
}
export async function getResultWorkflow(billId: string) {
  if (!Types.ObjectId.isValid(billId)) throw new ApiError(400, "Invalid bill ID");
  const bill = await LabBill.findById(billId).exec();
  if (!bill) throw new ApiError(404, "Bill not found");
  if (bill.status !== "generated") throw new ApiError(422, "Reports require a generated, non-cancelled bill");
  const results = await LabTestResult.find({ billId: bill._id, patientId: bill.patientId }).exec();
  const due = verifiedOutstandingDue(bill);
  if (!Number.isFinite(due) || due < 0) {
    throw new ApiError(422, "Bill outstanding due could not be verified. Report generation is not allowed.");
  }
  const confirmations = results.length ? await AuditLog.find({
    entityType: "LabTestResult", entity: { $in: results.map((row) => row._id) },
    action: { $in: [SUBMISSION_PENDING, SUBMISSION_CONFIRMED] },
  }).sort({ timestamp: -1, _id: -1 }).exec() : [];
  const outsideIds = bill.items.filter(item => item.outsideLabId).map(item => item.testId);
  const uploads = outsideIds.length ? await LabReportUpload.find({billId:bill._id,patientId:bill.patientId,testId:{$in:outsideIds}})
    .select("testId collectionId size selectedAt createdAt").sort({createdAt:-1,_id:-1}).lean().exec() : [];
  const tests = [...new Set(bill.items.map((item) => String(item.testId)))].map((testId) => {
    const item = bill.items.find(item=>String(item.testId)===testId)!;
    const saved = results.filter((row) => String(row.testId) === testId&&currentCollectionResult(row,item.activeCollectionId));
    const savedIds = new Set(saved.map((row) => String(row._id)));
    const latest = confirmations.find((row) => savedIds.has(String(row.entity)));
    const upload = item.outsideLabId ? newestReportUpload(uploads).find(row => String(row.testId) === testId && row.size > 0 &&
      String(row.collectionId ?? "") === String(item.activeCollectionId ?? "")) : undefined;
    return { testId, collectionId: item.activeCollectionId?.toString(), submitted: persistedSubmission(saved, latest?.action),
      ...(upload ? {uploadedReportId:String(upload._id)} : {}) };
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
  // Legacy callers cannot use this compatibility argument to bypass financial rules.
  void restrictDue;
  if (workflow.hasOutstandingDue) throw new ApiError(422, PATIENT_DUE_MESSAGE);
  return workflow;
}

/** Print readiness also accepts a validated current outside PDF, without claiming result submission. */
export async function assertPrintableReportAllowed(billId:string,testIds:string[]) {
  if(!testIds.length || testIds.some(id=>!Types.ObjectId.isValid(id)))throw new ApiError(400,"Select submitted tests or uploaded outside reports to print");
  const workflow=await getResultWorkflow(billId);
  if(testIds.some(id=>!workflow.tests.some(test=>test.testId===id && (test.submitted || test.uploadedReportId))))
    throw new ApiError(422,"Submit the selected test results or upload the outside report before printing.");
  if(workflow.hasOutstandingDue)throw new ApiError(422,PATIENT_DUE_MESSAGE);
  return workflow;
}
