import { test } from "node:test";
import assert from "node:assert/strict";
import { whatsappAttachmentReady } from "./whatsapp-readiness.ts";
const pdf = { filename: "selected-report.pdf", mimeType: "application/pdf", base64: "JVBERi0xLjQ=" };
test("actual report/invoice readiness changes from failed to ready after preparation retry", () => {
  for (const templateName of ["lab_report_ready", "lab_invoice_ready"]) {
    assert.equal(whatsappAttachmentReady(templateName), false);
    assert.equal(whatsappAttachmentReady(templateName, { templateName, attachment: null }), false);
    assert.equal(whatsappAttachmentReady(templateName, { templateName, attachment: pdf }), true);
  }
});
test("greeting requires no PDF and stale/wrong attachments cannot enable Submit", () => {
  assert.equal(whatsappAttachmentReady("patient_thank_you", { templateName: "patient_thank_you", attachment: null }), true);
  assert.equal(whatsappAttachmentReady("lab_report_ready", { templateName: "lab_invoice_ready", attachment: pdf }), false);
  assert.equal(whatsappAttachmentReady("lab_report_ready", { templateName: "lab_report_ready", attachment: { ...pdf, base64: "dummy" } }), false);
});