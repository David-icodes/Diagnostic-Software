import { test } from "node:test";
import assert from "node:assert/strict";
import { LIS_TEMPLATES, languageFor, templateComponents, templateVariables } from "./lis-template";
import { reviewLisMessageSchema } from "../../validations/whatsapp-lis";

const value = { patientName: "Test Patient", centreName: "Configured Centre", patientCode: "GP123", billNumber: "OSP456", billDate: "08 Oct 2026", reportDate: "09 Oct 2026", net: 123.45, paid: 100, balance: 23.45 };
test("three new templates coexist without legacy aliasing; exact variable order", () => {
  assert.deepEqual(Object.keys(LIS_TEMPLATES), ["lab_report_ready", "lab_invoice_ready", "patient_thank_you"]);
  assert.deepEqual(templateVariables("lab_report_ready", value), ["Test Patient", "Configured Centre", "Test Patient", "GP123", "OSP456", "09 Oct 2026"]);
  assert.deepEqual(templateVariables("lab_invoice_ready", value), ["Test Patient", "Configured Centre", "Test Patient", "GP123", "OSP456", "08 Oct 2026", "123.45", "100.00", "23.45"]);
  assert.deepEqual(templateVariables("patient_thank_you", value), ["Test Patient", "Configured Centre"]);
});
test("new languages require explicit Meta configuration and never default", () => {
  for (const template of Object.keys(LIS_TEMPLATES) as Array<keyof typeof LIS_TEMPLATES>) {
    assert.throws(() => languageFor(template, {}), /exact language code from Meta/);
    assert.throws(() => languageFor(template, { [LIS_TEMPLATES[template].languageSetting]: " " }));
    assert.equal(languageFor(template, { [LIS_TEMPLATES[template].languageSetting]: "configured_locale" }), "configured_locale");
  }
});
test("reports/invoices require document headers; greeting contains only body", () => {
  for (const template of ["lab_report_ready", "lab_invoice_ready"] as const) {
    const variables = templateVariables(template, value);
    assert.throws(() => templateComponents(template, variables), /PDF attachment/);
    assert.deepEqual(templateComponents(template, variables, "actual-upload-id", "actual.pdf")[0], {
      type: "header", parameters: [{ type: "document", document: { id: "actual-upload-id", filename: "actual.pdf" } }],
    });
  }
  assert.deepEqual(templateComponents("patient_thank_you", templateVariables("patient_thank_you", value)), [{ type: "body", parameters: [{ type: "text", text: "Test Patient" }, { type: "text", text: "Configured Centre" }] }]);
});
test("blank dependencies and non-finite billing amounts are rejected", () => {
  assert.throws(() => templateVariables("lab_report_ready", { ...value, reportDate: undefined }));
  assert.throws(() => templateVariables("patient_thank_you", { ...value, centreName: "" }));
  for (const amount of [NaN, Infinity, -1]) assert.throws(() => templateVariables("lab_invoice_ready", { ...value, net: amount }));
});
test("review permits only trusted IDs/options; rejects arbitrary recipients, languages and documents", () => {
  const input = { patientId: "a".repeat(24), billId: "b".repeat(24), templateName: "patient_thank_you" };
  assert.equal(reviewLisMessageSchema.parse(input).templateName, "patient_thank_you");
  for (const field of ["mobile", "languageCode", "centreName", "pdf", "variables"]) assert.equal(reviewLisMessageSchema.safeParse({ ...input, [field]: "untrusted" }).success, false);
  assert.equal(reviewLisMessageSchema.safeParse({ ...input, templateName: "report_ready" }).success, false);
});

test("each template selects its own exact language without a legacy fallback", () => {
  const config = { WHATSAPP_LAB_REPORT_READY_LANGUAGE: "report_locale", WHATSAPP_LAB_INVOICE_READY_LANGUAGE: "invoice_locale", WHATSAPP_PATIENT_THANK_YOU_LANGUAGE: "greeting_locale" };
  assert.equal(languageFor("lab_report_ready", config), "report_locale");
  assert.equal(languageFor("lab_invoice_ready", config), "invoice_locale");
  assert.equal(languageFor("patient_thank_you", config), "greeting_locale");
});
test("review workflows are explicit and unknown scopes cannot bypass validation", () => {
  const input = { patientId: "a".repeat(24), billId: "b".repeat(24), templateName: "lab_report_ready" };
  assert.equal(reviewLisMessageSchema.parse(input).workflow, undefined);
  assert.equal(reviewLisMessageSchema.parse({ ...input, workflow: "lab-reprint" }).workflow, "lab-reprint");
  assert.equal(reviewLisMessageSchema.safeParse({ ...input, workflow: "ignore-validation" }).success, false);
});
