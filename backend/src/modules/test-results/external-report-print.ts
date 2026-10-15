import { PDFDocument, PDFName } from "pdf-lib";
import type { Request } from "express";
import { ApiError } from "../../utils/api-error";
import { LabBill } from "../../models/lab-bill.model";
import { assertBillDocumentAllowed } from "./result-workflow.service";
import { readReportUpload } from "./report-upload.service";
import { renderExternalReportCover } from "./report-pdf.service";
import { validatePdf } from "../documents/pdf-integrity";

/** Never overlay or resize source pages. Original bytes remain separately retrievable. */
export async function appendExternalPages(cover: Buffer, original: Buffer): Promise<Buffer> {
  await validatePdf(cover, "report");
  await validatePdf(original, "attachment");
  const source = await PDFDocument.load(original, { updateMetadata: false });
  if (source.catalog.has(PDFName.of("AcroForm"))) throw new ApiError(422, "This PDF contains interactive or signed fields. View the unchanged original instead of generating a print copy.");
  const output = await PDFDocument.load(cover);
  const pages = await output.copyPages(source, source.getPageIndices());
  pages.forEach(page => output.addPage(page));
  return Buffer.from(await output.save());
}

export async function printExternalReport(billId: string, testId: string, id: string,
  header: "header" | "none" | "letterhead", req: Request) {
  const row = await readReportUpload(billId, testId, id);
  const bill = await LabBill.findById(billId).exec();
  if (!bill?.items.some(item => String(item.testId) === testId && item.outsideLabId))
    throw new ApiError(422, "Only an outside-laboratory test can use external report printing.");
  const collectionId = bill.items.find(item => String(item.testId) === testId)?.activeCollectionId;
  const cover = await renderExternalReportCover(billId, testId, row.fileName, header === "header", header === "letterhead", req);
  const bytes = await appendExternalPages(cover, row.content!);
  const current = await LabBill.findById(billId).exec();
  if (!current?.items.some(item => String(item.testId) === testId && item.outsideLabId && String(item.activeCollectionId ?? "") === String(collectionId ?? "")))
    throw new ApiError(409, "The outside order changed. Reload before printing.");
  await assertBillDocumentAllowed(billId);
  return bytes;
}
