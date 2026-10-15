import { test } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { LabBill } from "../../models/lab-bill.model";
import { LabReportUpload } from "../../models/lab-report-upload.model";
import { LabTestResult } from "../../models/lab-test-result.model";
import { AuditLog } from "../../models/audit-log.model";
import { PDFDocument } from "pdf-lib";
process.env.MONGODB_URI = "mongodb://127.0.0.1/report_upload_tests_no_connection";
process.env.JWT_SECRET = "test-only-report-upload-validation-secret";
for (const key of ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"]) process.env[key] = "";
const modules = Promise.all([import("./report-upload.service.js"), import("../documents/pdf-storage.service.js")]);
async function syntheticPdf() {
  const pdf = await PDFDocument.create(); pdf.addPage([612, 792]).drawText("Synthetic attachment");
  return Buffer.from(await pdf.save());
}

test("report upload validates bounded PDF bytes and safe PDF filename", async () => {
  const [{ validateReportPdf, MAX_REPORT_BYTES }] = await modules;
  const pdf = Buffer.from("%PDF-1.4\nunit test fixture\n%%EOF\n");
  assert.equal(validateReportPdf(pdf, "C:\\reports\\test.pdf").fileName, "test.pdf");
  assert.throws(() => validateReportPdf(Buffer.from("not PDF"), "test.pdf"));
  assert.throws(() => validateReportPdf(pdf, "test.html"));
  assert.throws(() => validateReportPdf(Buffer.alloc(MAX_REPORT_BYTES + 1), "large.pdf"));
  assert.throws(() => validateReportPdf(Buffer.from("%PDF-1.4 incomplete"), "test.pdf"));
  assert.throws(() => validateReportPdf(null, "test.pdf"));
});

test("fresh results cannot unlock an attachment from a superseded collection", async t=>{
 const [{readReportUpload,listReportUploads}]=await modules;
 const billId=new Types.ObjectId(),testId=new Types.ObjectId(),patientId=new Types.ObjectId(),activeCollectionId=new Types.ObjectId();
 const q=(value:unknown)=>{const query={exec:async()=>value,select:()=>query,sort:()=>query};return query;};
 t.mock.method(LabBill,"findById",()=>q({_id:billId,patientId,status:"generated",dueAmount:0,items:[{testId,activeCollectionId}]}));
 t.mock.method(LabTestResult,"find",()=>q([{_id:new Types.ObjectId(),testId,result:16,version:2,enteredAt:new Date()}]));
 t.mock.method(AuditLog,"find",()=>q([]));
 t.mock.method(LabReportUpload,"findOne",(filter:Record<string,unknown>)=>{assert.equal(filter.collectionId,activeCollectionId);return q(null);});
 t.mock.method(LabReportUpload,"find",(filter:Record<string,unknown>)=>{assert.equal(filter.collectionId,activeCollectionId);return q([]);});
 assert.deepEqual(await listReportUploads(String(billId),String(testId)),[]);
 await assert.rejects(readReportUpload(String(billId),String(testId),String(new Types.ObjectId())),/not found/);
});

test("uploaded report retrieval rechecks submission, dues and exact patient/bill/test binding", async (t) => {
  const [{ readReportUpload }] = await modules;
  const billId = new Types.ObjectId(); const testId = new Types.ObjectId(); const patientId = new Types.ObjectId();
  const uploadId = new Types.ObjectId(); const resultId = new Types.ObjectId();
  const bill = { _id: billId, patientId, status: "generated", items: [{ testId }], dueAmount: 0 };
  const report = { _id: uploadId, fileName: "report.pdf", content: Buffer.from("PDF"),
    uploadedBy: new Types.ObjectId(), storageKey: undefined as string | undefined };
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
  const legacy = Buffer.from(report.content);
  report.storageKey = "b".repeat(64);
  const [, { pdfStorage }] = await modules;
  t.mock.method(pdfStorage, "retrieve", async (key: string, scope: import("../documents/pdf-storage.service").PdfScope) => {
    assert.equal(key, report.storageKey); assert.deepEqual(scope, { owner: String(report.uploadedBy), billId: String(billId),
      patientId: String(patientId), testId: String(testId), kind: "attachment" }); return legacy;
  });
  assert.deepEqual((await readReportUpload(String(billId), String(testId), String(uploadId))).content, legacy);
  report.storageKey = undefined;
  bill.dueAmount = 25; await assert.rejects(readReportUpload(String(billId), String(testId), String(uploadId)), /outstanding due/);
  assert.equal(reads, 2);
  bill.dueAmount = 0; submitted = false; await assert.rejects(readReportUpload(String(billId), String(testId), String(uploadId)), /Submit/);
  assert.equal(reads, 2);
  submitted = true; missing = true; await assert.rejects(readReportUpload(String(billId), String(testId), String(uploadId)), /not found/);
});

test("uploads bind the actual bill patient and ordered test without completing results", async (t) => {
  const [{ saveReportUpload, listReportUploads }, { pdfStorage }] = await modules;
  t.mock.method(pdfStorage, "store", async () => undefined);
  const billId = new Types.ObjectId(); const testId = new Types.ObjectId(); const patientId = new Types.ObjectId();
  const userId = new Types.ObjectId(); const uploadId = new Types.ObjectId();
  const pdf = await syntheticPdf();
  let saved: Record<string, unknown> | undefined;
  t.mock.method(LabReportUpload,"findOne",()=>({exec:async()=>null}));
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
  await assert.rejects(saveReportUpload(String(userId), String(billId), String(testId), "report.pdf",
    Buffer.from("%PDF-1.4\nnot a parseable document\n%%EOF")), /invalid/);
});

test("configured attachment upload persists only a restricted key; failures never create a successful attachment", async (t) => {
  const [{ saveReportUpload }, { pdfStorage }] = await modules;
  const billId = new Types.ObjectId(); const testId = new Types.ObjectId(); const patientId = new Types.ObjectId();
  const userId = new Types.ObjectId(); const key = "a".repeat(64);
  const pdf = await syntheticPdf();
  t.mock.method(LabBill, "findById", () => ({ exec: async () => ({ _id: billId, patientId, status: "generated", items: [{ testId }] }) }));
  t.mock.method(LabReportUpload,"findOne",()=>({exec:async()=>null}));
  let creates = 0;
  t.mock.method(pdfStorage, "store", async (bytes: Buffer, scope: import("../documents/pdf-storage.service").PdfScope) => {
    assert.deepEqual(bytes, pdf); assert.deepEqual(scope, { owner: String(userId), billId: String(billId),
      patientId: String(patientId), testId: String(testId), kind: "attachment" }); return key;
  });
  t.mock.method(LabReportUpload, "create", async (data: any) => {
    creates++; assert.equal(data.storageKey, key); assert.equal("content" in data, false);
    return { ...data, _id: new Types.ObjectId(), createdAt: new Date() };
  });
  await saveReportUpload(String(userId), String(billId), String(testId), "synthetic.pdf", pdf);
  t.mock.method(pdfStorage, "store", async () => { throw new Error("restricted storage unavailable"); });
  await assert.rejects(saveReportUpload(String(userId), String(billId), String(testId), "synthetic.pdf", pdf), /unavailable/);
  assert.equal(creates, 1);
});
