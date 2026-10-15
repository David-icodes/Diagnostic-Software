import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Types } from "mongoose";
import { PDFDocument, degrees } from "pdf-lib";
import { LabBill } from "../../models/lab-bill.model";
import { LabReportUpload } from "../../models/lab-report-upload.model";
import { LabTestResult } from "../../models/lab-test-result.model";
import { roleHasPermission } from "../../middleware/require-permission";

process.env.MONGODB_URI = "mongodb://127.0.0.1/external_report_tests_no_connection";
process.env.JWT_SECRET = "test-only-external-report-validation-secret";
for (const key of ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"]) process.env[key] = "";
const modules = Promise.all([import("./report-upload.service.js"), import("./external-report-print.js")]);
const q = (value: unknown) => { const result = { exec: async () => value, select: () => result }; return result; };

test("source upload/view and external printing retain separate role permissions", () => {
  assert.equal(roleHasPermission("admin", "test_results.enter"), true);
  assert.equal(roleHasPermission("staff", "reports.print"), true);
  assert.equal(roleHasPermission("operator", "test_results.view"), true);
  assert.equal(roleHasPermission("operator", "test_results.enter"), false);
  assert.equal(roleHasPermission("operator", "reports.print"), false);
  for (const permission of ["test_results.view", "test_results.enter", "reports.print"]) assert.equal(roleHasPermission("vendor", permission), false);
});

test("outside source retrieval needs no fabricated in-house results; dues and exact ownership remain enforced", async t => {
  const [{ readReportUpload }] = await modules;
  const billId = new Types.ObjectId(), patientId = new Types.ObjectId(), testId = new Types.ObjectId(), uploadId = new Types.ObjectId();
  const bill = { _id: billId, patientId, status: "generated", dueAmount: 0, items: [{ testId, outsideLabId: new Types.ObjectId() }] };
  const pdf = await PDFDocument.create(); pdf.addPage();
  const row = { _id: uploadId, fileName: "synthetic.pdf", content: Buffer.from(await pdf.save()) };
  t.mock.method(LabBill, "findById", () => q(bill) as any);
  t.mock.method(LabTestResult, "find", () => { throw Error("Do not require/create in-house results for external source viewing"); });
  let exists = true;
  t.mock.method(LabReportUpload, "findOne", (filter: any) => {
    assert.equal(String(filter.billId), String(billId)); assert.equal(String(filter.patientId), String(patientId));
    assert.equal(filter.testId, String(testId)); assert.equal(filter._id, String(uploadId)); return q(exists ? row : null) as any;
  });
  assert.deepEqual((await readReportUpload(String(billId), String(testId), String(uploadId))).content, row.content);
  bill.dueAmount = 10;
  await assert.rejects(readReportUpload(String(billId), String(testId), String(uploadId)), /outstanding due/);
  bill.dueAmount = 0; exists = false;
  await assert.rejects(readReportUpload(String(billId), String(testId), String(uploadId)), /not found/);
});

test("same PDF retries reuse the saved attachment, while invalid files never reach storage", async t => {
  const [{ saveReportUpload }] = await modules;
  const billId = new Types.ObjectId(), patientId = new Types.ObjectId(), testId = new Types.ObjectId(), uploadId = new Types.ObjectId();
  const pdf = await PDFDocument.create(); pdf.addPage(); const content = Buffer.from(await pdf.save());
  t.mock.method(LabBill, "findById", () => q({ _id: billId, patientId, status: "generated", items: [{ testId }] }) as any);
  t.mock.method(LabReportUpload, "findOne", (filter: any) => {
    assert.equal(filter.sha256, createHash("sha256").update(content).digest("hex"));
    return q({ _id: uploadId, fileName: "synthetic.pdf", size: content.length, createdAt: new Date() }) as any;
  });
  t.mock.method(LabReportUpload, "create", () => { throw Error("Must reuse the existing attachment"); });
  assert.equal((await saveReportUpload(String(new Types.ObjectId()), String(billId), String(testId), "synthetic.pdf", content)).id, String(uploadId));
  await assert.rejects(saveReportUpload(String(new Types.ObjectId()), String(billId), String(testId), "bad.pdf", Buffer.from("%PDF-invalid\n%%EOF")), /invalid/);
});

test("cover printing preserves source dimensions, rotations and bytes without rasterizing or overlaying", async () => {
  const [, { appendExternalPages }] = await modules;
  const cover = await PDFDocument.create(); cover.addPage([595.28, 841.89]).drawText("Synthetic cover");
  const source = await PDFDocument.create();
  source.addPage([612, 792]).drawText("Portrait synthetic clinical value 0.05");
  source.addPage([792, 612]).drawText("Landscape synthetic clinical value 12.0");
  source.addPage([612, 792]).setRotation(degrees(90));
  const original = Buffer.from(await source.save()), before = Buffer.from(original);
  const output = await PDFDocument.load(await appendExternalPages(Buffer.from(await cover.save()), original));
  assert.equal(output.getPageCount(), 4);
  source.getPages().forEach((page, index) => {
    assert.deepEqual(output.getPage(index + 1).getSize(), page.getSize());
    assert.deepEqual(output.getPage(index + 1).getRotation(), page.getRotation());
  });
  assert.deepEqual(original, before);
  source.getForm().createTextField("clinical-value").setText("15");
  await assert.rejects(appendExternalPages(Buffer.from(await cover.save()), Buffer.from(await source.save())), /interactive or signed fields/);
});
