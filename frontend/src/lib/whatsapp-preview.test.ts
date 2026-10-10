import { test } from "node:test";
import assert from "node:assert/strict";
import { whatsappPreview } from "./whatsapp-preview.ts";

test("report preview uses selected patient, bill and report date", () => {
  const preview = whatsappPreview("lab_report_ready", ["Patient", "Centre", "Patient", "GP1", "Bill2", "09 Oct 2026"]);
  assert.match(preview, /Patient ID: GP1\nBill No: Bill2\nReport Date: 09 Oct 2026/);
  assert.match(preview, /laboratory report attached/);
});
test("invoice preview presents ordered selected-bill totals", () => {
  const preview = whatsappPreview("lab_invoice_ready", ["Patient", "Centre", "Patient", "GP1", "Bill2", "08 Oct 2026", "100.00", "80.00", "20.00"]);
  assert.match(preview, /Net Amount: ₹100.00\nPaid Amount: ₹80.00\nBalance: ₹20.00/);
  assert.match(preview, /invoice attached/);
});
test("greeting preview has the configured centre and no attachment", () => {
  const preview = whatsappPreview("patient_thank_you", ["Patient", "Configured Centre"]);
  assert.match(preview, /Thank you for choosing Configured Centre/);
  assert.doesNotMatch(preview, /attached|invoice|report|undefined/);
});

test("preview preserves actual approved Meta text rather than the proposed wording", () => {
  assert.match(whatsappPreview("lab_report_ready", ["Patient", "Centre", "Patient", "GP1", "B1", "Date"]), /^Header:\nLaboratory Report\n\nBody:/);
  assert.match(whatsappPreview("lab_report_ready", ["Patient", "Centre", "Patient", "GP1", "B1", "Date"]), /Thank you\.\n\nFoo$/);
  assert.doesNotMatch(whatsappPreview("patient_thank_you", ["Patient", "Centre"]), /Regards/);
  assert.match(whatsappPreview("lab_invoice_ready", ["Patient", "Centre", "Patient", "GP1", "B1", "Date", "1", "0", "1"]), /Thank you\.$/);
});
