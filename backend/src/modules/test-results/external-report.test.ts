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
    return q({ _id: uploadId, fileName: "synthetic.pdf", size: content.length, createdAt: new Date(), save: async function (this: {selectedAt?: Date; selectedBy?: unknown}) { assert.ok(this.selectedAt); assert.ok(this.selectedBy); } }) as any;
  });
  t.mock.method(LabReportUpload, "updateOne", (filter: any, update: any, options: any) => {
    assert.equal(String(filter._id), String(uploadId)); assert.equal(options.runValidators, true);
    assert.deepEqual(Object.keys(update.$set).sort(), ["selectedAt", "selectedBy"]);
    return q({matchedCount: 1}) as any;
  });
  t.mock.method(LabReportUpload, "create", () => { throw Error("Must reuse the existing attachment"); });
  assert.equal((await saveReportUpload(String(new Types.ObjectId()), String(billId), String(testId), "synthetic.pdf", content)).id, String(uploadId));
  await assert.rejects(saveReportUpload(String(new Types.ObjectId()), String(billId), String(testId), "bad.pdf", Buffer.from("%PDF-invalid\n%%EOF")), /invalid/);
});

test("non-A4 PDFs receive a reserved header band and interactive PDFs reject composition", async () => {
  const [, { appendExternalPages }] = await modules;
  const cover = await PDFDocument.create(); cover.addPage([595.28, 841.89]).drawText("Synthetic cover");
  const source = await PDFDocument.create();
  source.addPage([612, 792]).drawText("Portrait synthetic clinical value 0.05");
  source.addPage([792, 612]).drawText("Landscape synthetic clinical value 12.0");
  source.addPage([612, 792]).setRotation(degrees(90));
  const original = Buffer.from(await source.save()), before = Buffer.from(original);
  const {sharedReportHeader}=await import("./report-header-asset.js");
  const composed=await PDFDocument.load(await appendExternalPages(await sharedReportHeader(),original));
  assert.equal(composed.getPageCount(),3);assert.equal(composed.getPage(0).getWidth(),612);assert.ok(composed.getPage(0).getHeight()>792);
  const output = await PDFDocument.load(original);
  assert.equal(output.getPageCount(), 3);
  source.getPages().forEach((page, index) => {
    assert.deepEqual(output.getPage(index).getSize(), page.getSize());
    assert.deepEqual(output.getPage(index).getRotation(), page.getRotation());
  });
  assert.deepEqual(original, before);
  source.getForm().createTextField("clinical-value").setText("15");
  await assert.rejects(appendExternalPages(await sharedReportHeader(), Buffer.from(await source.save())), /Interactive or signed PDFs/);
});


test("reserved header space preserves page count and supports existing outside headers", async () => {
 const [, {appendExternalPages}] = await modules;
 const cover=await PDFDocument.create();cover.addPage([595.28,841.89]).drawText("Synthetic header",{x:32,y:790,size:14});
 const source=await PDFDocument.create();source.addPage([595.28,841.89]).drawText("Synthetic result 12.0",{x:32,y:650,size:12});
 source.addPage([792,612]).drawText("Synthetic multipage 0.05",{x:32,y:500,size:12});
 source.getPage(1).setRotation(degrees(90));
 const original=Buffer.from(await source.save()),coverBytes=await (await import("./report-header-asset.js")).sharedReportHeader();
 const bytes=await appendExternalPages(coverBytes,original);assert.notDeepEqual(bytes,original);
 const output=await PDFDocument.load(bytes);assert.equal(output.getPageCount(),2);assert.equal(output.getPage(0).getWidth(),source.getPage(0).getWidth());assert.ok(output.getPage(0).getHeight()>source.getPage(0).getHeight());assert.deepEqual(output.getPage(1).getSize(),source.getPage(1).getSize());assert.equal(output.getPage(1).getRotation().angle,90);
 const brandedSource=await PDFDocument.create();brandedSource.addPage([595.28,841.89]).drawText("Existing outside header",{x:32,y:790,size:14});
 const branded=Buffer.from(await brandedSource.save());assert.equal((await PDFDocument.load(await appendExternalPages(coverBytes,branded))).getPageCount(),1);
 const {hasBlankHeaderSpace}=await import("./external-report-space.js");
 const graphic=await PDFDocument.create();graphic.addPage([595.28,841.89]).drawRectangle({x:0,y:800,width:595,height:25});assert.equal(await hasBlankHeaderSpace(Buffer.from(await graphic.save())),false);
});
