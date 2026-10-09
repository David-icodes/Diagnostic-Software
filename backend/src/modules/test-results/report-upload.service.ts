import { Types } from "mongoose";
import { LabBill } from "../../models/lab-bill.model";
import { LabReportUpload } from "../../models/lab-report-upload.model";
import { ApiError } from "../../utils/api-error";
import { assertResultReportAllowed } from "./result-workflow.service";

export const MAX_REPORT_BYTES = 5 * 1024 * 1024;
export function validateReportPdf(content: unknown, name: string): { content: Buffer; fileName: string } {
  if (!Buffer.isBuffer(content) || !content.length || content.length > MAX_REPORT_BYTES)
    throw new ApiError(422, "Select a PDF report up to 5 MB.");
  if (content.subarray(0, 5).toString("ascii") !== "%PDF-" || !content.subarray(-1024).includes(Buffer.from("%%EOF")))
    throw new ApiError(422, "The selected file is not a valid PDF report.");
  const fileName = name.split(/[\\/]/).pop()?.replace(/[\x00-\x1f\x7f";]/g, "").trim();
  if (!fileName || fileName.length > 160 || !/\.pdf$/i.test(fileName)) throw new ApiError(422, "Select a report with a PDF filename.");
  return { content, fileName };
}

async function orderedBill(billId: string, testId: string) {
  if (!Types.ObjectId.isValid(billId) || !Types.ObjectId.isValid(testId)) throw new ApiError(400, "Invalid bill or test.");
  const bill = await LabBill.findById(billId).exec();
  if (!bill || bill.status !== "generated") throw new ApiError(404, "Generated bill not found.");
  if (!bill.items.some((item) => String(item.testId) === testId)) throw new ApiError(422, "Test is not ordered on this bill.");
  return bill;
}

export async function saveReportUpload(userId: string, billId: string, testId: string, name: string, body: unknown) {
  const file = validateReportPdf(body, name);
  const bill = await orderedBill(billId, testId);
  const saved = await LabReportUpload.create({ billId: bill._id, patientId: bill.patientId, testId,
    uploadedBy: userId, fileName: file.fileName, size: file.content.length, content: file.content });
  return { id: String(saved._id), fileName: saved.fileName, size: saved.size, createdAt: saved.createdAt };
}

export async function listReportUploads(billId: string, testId: string) {
  const bill = await orderedBill(billId, testId);
  const rows = await LabReportUpload.find({ billId: bill._id, patientId: bill.patientId, testId }).sort({ createdAt: -1, _id: -1 }).exec();
  return rows.map((row) => ({ id: String(row._id), fileName: row.fileName, size: row.size, createdAt: row.createdAt }));
}

export async function readReportUpload(billId: string, testId: string, id: string) {
  if (!Types.ObjectId.isValid(id)) throw new ApiError(400, "Invalid uploaded report.");
  const bill = await orderedBill(billId, testId);
  // Retrieving printable attachments obeys the same fresh due/submission check.
  await assertResultReportAllowed(billId, [testId]);
  const row = await LabReportUpload.findOne({ _id: id, billId: bill._id, patientId: bill.patientId, testId }).select("+content").exec();
  if (!row) throw new ApiError(404, "Uploaded report not found.");
  return row;
}
