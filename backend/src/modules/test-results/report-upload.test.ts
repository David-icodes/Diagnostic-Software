import { test } from "node:test";
import assert from "node:assert/strict";
import { validateReportPdf, MAX_REPORT_BYTES, saveReportUpload, listReportUploads, readReportUpload } from "./report-upload.service";
import { Types } from "mongoose";
import { LabBill } from "../../models/lab-bill.model";
import { LabReportUpload } from "../../models/lab-report-upload.model";
import { LabTestResult } from "../../models/lab-test-result.model";
import { AuditLog } from "../../models/audit-log.model";

test("report upload validates bounded PDF bytes and safe PDF filename", () => {
  const pdf = Buffer.from("%PDF-1.4\nunit test fixture\n%%EOF\n");
  assert.equal(validateReportPdf(pdf, "C:\\reports\\test.pdf").fileName, "test.pdf");
  assert.throws(() => validateReportPdf(Buffer.from("not PDF"), "test.pdf"));
  assert.throws(() => validateReportPdf(pdf, "test.html"));
  assert.throws(() => validateReportPdf(Buffer.alloc(MAX_REPORT_BYTES + 1), "large.pdf"));
  assert.throws(() => validateReportPdf(Buffer.from("%PDF-1.4 incomplete"), "test.pdf"));
  assert.throws(() => validateReportPdf(null, "test.pdf"));
});

test("uploaded report retrieval rechecks submission, dues and exact patient/bill/test binding", async (t) => {
  const billId = new Types.ObjectId(); const testId = new Types.ObjectId(); const patientId = new Types.ObjectId();
  const uploadId = new Types.ObjectId(); const resultId = new Types.ObjectId();
  const bill = { _id: billId, patientId, status: "generated", items: [{ testId }], dueAmount: 0 };
  const report = { _id: uploadId, fileName: "report.pdf", content: Buffer.from("PDF") };
  let submitted = true; let missing = false; let reads = 0;
  const q = (value: unknown) => { const chain = { exec: async () => value, select: () => chain, lean: () => chain, sort: () => chain }; return chain; };
  t.mock.method(LabBill, "findById", () => q(bill));
  t.mock.method(LabBill, "find", () => { throw new Error("Do not query other bills for the due restriction"); });
  t.mock.method(LabTestResult, "find", () => q(submitted ? [{ _id: resultId, testId, version: 1, enteredAt: new Date(), result: 0 }] : []));
  t.mock.method(AuditLog, "find", () => q([]));
  t.mock.method(LabReportUpload, "findOne", (filter: Record<string, unknown>) => {
    reads++; assert.equal(filter._id, String(uploadId)); assert.equal(filter.billId, billId);
    assert.equal(filter.patientId, patientId); assert.equal(filter.testId, String(testId)); return q(missing ? null : report);
  });
  assert.equal(await readReportUpload(String(billId), String(testId), String(uploadId)), report);
  bill.dueAmount = 25; await assert.rejects(readReportUpload(String(billId), String(testId), String(uploadId)), /outstanding due/);
  assert.equal(reads, 1);
  bill.dueAmount = 0; submitted = false; await assert.rejects(readReportUpload(String(billId), String(testId), String(uploadId)), /Submit/);
  assert.equal(reads, 1);
  submitted = true; missing = true; await assert.rejects(readReportUpload(String(billId), String(testId), String(uploadId)), /not found/);
});

test("uploads bind the actual bill patient and ordered test without completing results", async (t) => {
  const billId = new Types.ObjectId(); const testId = new Types.ObjectId(); const patientId = new Types.ObjectId();
  const userId = new Types.ObjectId(); const uploadId = new Types.ObjectId();
  const pdf = Buffer.from("%PDF-1.4\nmock report\n%%EOF\n");
  let saved: Record<string, unknown> | undefined;
  t.mock.method(LabBill, "findById", () => ({ exec: async () => ({ _id: billId, patientId, status: "generated", items: [{ testId }] }) }));
  t.mock.method(LabReportUpload, "create", async (input: Record<string, unknown>) => { saved = input; return { ...input, _id: uploadId, createdAt: new Date() }; });
  const result = await saveReportUpload(String(userId), String(billId), String(testId), "report.pdf", pdf);
  assert.equal(result.id, String(uploadId)); assert.equal(saved?.patientId, patientId);
  assert.equal(saved?.billId, billId); assert.equal(saved?.testId, String(testId)); assert.equal(saved?.content, pdf);
  assert.equal("submitted" in saved!, false); assert.equal("result" in saved!, false);
  await assert.rejects(saveReportUpload(String(userId), String(billId), String(new Types.ObjectId()), "report.pdf", pdf), /not ordered/);
  await assert.rejects(saveReportUpload(String(userId), "invalid", String(testId), "report.pdf", pdf), /Invalid/);
  t.mock.method(LabReportUpload, "find", (filter: Record<string, unknown>) => {
    assert.equal(filter.patientId, patientId); assert.equal(filter.testId, String(testId));
    return { sort: () => ({ exec: async () => [{ _id: uploadId, fileName: "report.pdf", size: pdf.length, createdAt: new Date(), content: pdf }] }) };
  });
  const metadata = await listReportUploads(String(billId), String(testId));
  assert.equal(metadata.length, 1); assert.equal("content" in metadata[0], false);
  t.mock.method(LabReportUpload, "create", async () => { throw new Error("storage unavailable"); });
  await assert.rejects(saveReportUpload(String(userId), String(billId), String(testId), "report.pdf", pdf), /storage unavailable/);
});
