import { newestReportUpload } from "./report-upload-order";
import { createHash } from "node:crypto";
import { Types } from "mongoose";
import { LabBill } from "../../models/lab-bill.model";
import { LabReportUpload } from "../../models/lab-report-upload.model";
import { ApiError } from "../../utils/api-error";
import { assertBillDocumentAllowed, assertResultReportAllowed } from "./result-workflow.service";
import { pdfStorage } from "../documents/pdf-storage.service";
import { validatePdf } from "../documents/pdf-integrity";
import { timedPipeline } from "../whatsapp/pipeline-timing";

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
  await validatePdf(file.content, "attachment");
  const sha256 = createHash("sha256").update(file.content).digest("hex");
  const collectionId = bill.items.find(item => String(item.testId) === testId)?.activeCollectionId;
  const identity = { billId: bill._id, patientId: bill.patientId, testId,
    collectionId: collectionId ?? { $exists: false },
    sha256 };
  const existing = await LabReportUpload.findOne(identity).exec();
  if (existing) {
    const current = await orderedBill(billId, testId);
    if (String(current.items.find(item => String(item.testId) === testId)?.activeCollectionId ?? "") !== String(collectionId ?? ""))
      throw new ApiError(409, "The sample collection changed. Reload before uploading the report.");
    // Update selection metadata only: legacy MongoDB PDF content is intentionally
    // excluded from this query and must never be validated/replaced by this write.
    const selected = await LabReportUpload.updateOne({ ...identity, _id: existing._id },
      { $set: { selectedAt: new Date(), selectedBy: new Types.ObjectId(userId) } }, { runValidators: true }).exec();
    if (selected.matchedCount !== 1) throw new ApiError(409, "The uploaded report changed. Reload before retrying.");
    return { id: String(existing._id), fileName: existing.fileName, size: existing.size, createdAt: existing.createdAt };
  }
  const storageKey = await pdfStorage.store(file.content, { owner: userId, billId,
    patientId: String(bill.patientId), testId, kind: "attachment" });
  const current = await orderedBill(billId, testId);
  if (String(current.items.find(item => String(item.testId) === testId)?.activeCollectionId ?? "") !== String(collectionId ?? ""))
    throw new ApiError(409, "The sample collection changed. Reload before uploading the report.");
  let saved;
  try { saved = await LabReportUpload.create({ sha256, billId: bill._id, patientId: bill.patientId, testId,
    collectionId: bill.items.find(item=>String(item.testId)===testId)?.activeCollectionId,
    selectedAt: new Date(), selectedBy: userId, uploadedBy: userId, fileName: file.fileName, size: file.content.length,
    ...(storageKey ? { storageKey } : { content: file.content }) }); }
  catch (error) {
    if ((error as {code?:number}).code !== 11000) throw error;
    saved = await LabReportUpload.findOne(identity).exec();
    if (!saved) throw error;
  }
  return { id: String(saved._id), fileName: saved.fileName, size: saved.size, createdAt: saved.createdAt };
}

export async function listReportUploads(billId: string, testId: string) {
  const bill = await orderedBill(billId, testId);
  const rows = await LabReportUpload.find({ billId: bill._id, patientId: bill.patientId, testId, collectionId: bill.items.find(item=>String(item.testId)===testId)?.activeCollectionId ?? {$exists:false} }).sort({ createdAt: -1, _id: -1 }).exec();
  return newestReportUpload(rows).map((row) => ({ id: String(row._id), fileName: row.fileName, size: row.size, createdAt: row.createdAt, external: Boolean(bill.items.find(item => String(item.testId) === testId)?.outsideLabId) }));
}

export async function readReportUpload(billId: string, testId: string, id: string) {
  if (!Types.ObjectId.isValid(id)) throw new ApiError(400, "Invalid uploaded report.");
  const bill = await timedPipeline("application authorization", async () => {
    const ordered = await orderedBill(billId, testId);
    // An external source PDF is not an in-house result submission. Financial,
    // current-order and authenticated-access guards still apply.
    if (ordered.items.find(item => String(item.testId) === testId)?.outsideLabId) await assertBillDocumentAllowed(billId);
    else await assertResultReportAllowed(billId, [testId]);
    return ordered;
  });
  const row = await timedPipeline("attachment metadata lookup", () => LabReportUpload.findOne({ _id: id, billId: bill._id, patientId: bill.patientId, testId, collectionId: bill.items.find(item=>String(item.testId)===testId)?.activeCollectionId ?? {$exists:false} }).select("+content").exec());
  if (!row) throw new ApiError(404, "Uploaded report not found.");
  if (row.storageKey) {
    row.content = await pdfStorage.retrieve(row.storageKey, { owner: String(row.uploadedBy), billId,
      patientId: String(bill.patientId), testId, kind: "attachment" });
  }
  if (!row.content?.length) throw new ApiError(502, "Uploaded report content is unavailable.");
  const current = await orderedBill(billId, testId);
  const collectionId = current.items.find(item=>String(item.testId)===testId)?.activeCollectionId;
  if (String(collectionId ?? "") !== String(row.collectionId ?? "")) throw new ApiError(409,"The sample collection changed. Reload the current report");
  if (current.items.find(item => String(item.testId) === testId)?.outsideLabId) await assertBillDocumentAllowed(billId);
  else await assertResultReportAllowed(billId, [testId]);
  return row;
}
