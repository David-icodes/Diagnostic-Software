import { test } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { LabBill } from "../../models/lab-bill.model";
import { Patient } from "../../models/patient.model";
import { LabTestResult } from "../../models/lab-test-result.model";
import { AuditLog } from "../../models/audit-log.model";
import { LabSample } from "../../models/lab-sample.model";
import { WhatsAppMessage } from "../../models/whatsapp-message.model";
import type { Request } from "express";

// Test-only configuration. No database connection or actual Meta call is made.
process.env.MONGODB_URI = "mongodb://127.0.0.1/test_whatsapp_no_connection";
process.env.JWT_SECRET = "unit-test-only-not-a-deployment-secret";
const workflow = import("./lis-workflow.service.js");
const patientId = new Types.ObjectId(); const billId = new Types.ObjectId(); const testId = new Types.ObjectId();
const input = { patientId: String(patientId), billId: String(billId), templateName: "patient_thank_you" as const,
  testIds: [String(testId)], onlyEntered: false, printMode: "continuous" as const };
const patient = { _id: patientId, patientId: "GP_SELECTED", fullName: "Selected Patient", mobile: "+919876543210" };
const bill = { _id: billId, patientId, billNumber: "SELECTED_BILL", status: "generated", createdAt: new Date("2026-10-08T10:00:00Z"),
  netAmount: 125, paidAmount: 100, dueAmount: 25, items: [{ testId, testName: "Selected test" }] };
function query(value: unknown) {
  let populated = false;
  const chain = { exec: async () => populated && value === bill ? { ...bill, patientId: patient } : value,
    select: () => chain, lean: () => chain, sort: () => chain, populate: () => { populated = true; return chain; } };
  return chain;
}

test("server rejects bill/patient mismatch, missing patient and invalid mobile before any network call", async (t) => {
  const { loadLisContext } = await workflow;
  let currentBill: unknown = { ...bill, patientId: new Types.ObjectId() };
  let currentPatient: unknown = patient;
  t.mock.method(LabBill, "findById", () => query(currentBill));
  t.mock.method(Patient, "findById", () => query(currentPatient));
  t.mock.method(globalThis, "fetch", () => { throw new Error("Network must not be called"); });
  await assert.rejects(loadLisContext(input, "Operator"), /does not belong/);
  currentBill = bill; currentPatient = null;
  await assert.rejects(loadLisContext(input, "Operator"), /Patient not found/);
  currentPatient = { ...patient, mobile: "invalid" };
  await assert.rejects(loadLisContext(input, "Operator"), /valid destination/);
});

test("greeting uses deployment branding and exact selected bill without invoking the due guard", async (t) => {
  const { loadLisContext } = await workflow;
  t.mock.method(LabSample, "find", () => query([]));
  t.mock.method(LabBill, "findById", () => query(bill));
  t.mock.method(Patient, "findById", () => query(patient));
  t.mock.method(LabBill, "find", () => { throw new Error("No patient due restriction for greetings"); });
  t.mock.method(globalThis, "fetch", async (url: URL) => {
    assert.equal(url.pathname, "/whatsapp/organisation");
    return { ok: true, json: async () => ({ name: "Actual Deployment Centre" }) };
  });
  const context = await loadLisContext(input, "Operator");
  assert.equal(context.billNumber, "SELECTED_BILL");
  assert.equal(context.mobile, "+919876543210");
  assert.deepEqual(context.variables, ["Selected Patient", "Actual Deployment Centre"]);
  assert.deepEqual(context.document.reports, []);
});

test("report is blocked by outstanding due before branding lookup or PDF generation", async (t) => {
  const { loadLisContext } = await workflow;
  t.mock.method(LabBill, "findById", () => query(bill));
  t.mock.method(Patient, "findById", () => query(patient));
  t.mock.method(LabBill, "find", () => query([{ dueAmount: 25 }]));
  t.mock.method(LabTestResult, "find", () => query([{ _id: new Types.ObjectId(), testId, version: 1, enteredAt: new Date(), result: 0 }]));
  t.mock.method(AuditLog, "find", () => query([]));
  t.mock.method(globalThis, "fetch", () => { throw new Error("No document network access when patient has dues"); });
  await assert.rejects(loadLisContext({ ...input, templateName: "lab_report_ready" }, "Operator"), /outstanding due/);
});

test("report with no successfully submitted result cannot generate", async (t) => {
  const { loadLisContext } = await workflow;
  t.mock.method(LabBill, "findById", () => query(bill));
  t.mock.method(Patient, "findById", () => query(patient));
  t.mock.method(LabBill, "find", () => query([{ dueAmount: 0 }]));
  t.mock.method(LabTestResult, "find", () => query([]));
  t.mock.method(globalThis, "fetch", () => { throw new Error("No document network access before submission"); });
  await assert.rejects(loadLisContext({ ...input, templateName: "lab_report_ready" }, "Operator"), /Submit/);
});

test("missing exact language is a deployment requirement, not a guessed language", async () => {
  const { lisConfigurationError } = await workflow;
  assert.match(lisConfigurationError(input)!, /WHATSAPP_PATIENT_THANK_YOU_LANGUAGE/);
});

test("local mobiles default to India without changing patient data or requiring prefix configuration", async (t) => {
  const { loadLisContext, lisConfigurationError } = await workflow;
  const { env } = await import("../../config/env.js");
  const original = { prefix: env.WHATSAPP_LOCAL_COUNTRY_CODE, language: env.WHATSAPP_PATIENT_THANK_YOU_LANGUAGE, token: env.WHATSAPP_ACCESS_TOKEN, phone: env.WHATSAPP_PHONE_NUMBER_ID };
  t.after(() => Object.assign(env, { WHATSAPP_LOCAL_COUNTRY_CODE: original.prefix, WHATSAPP_PATIENT_THANK_YOU_LANGUAGE: original.language, WHATSAPP_ACCESS_TOKEN: original.token, WHATSAPP_PHONE_NUMBER_ID: original.phone }));
  Object.assign(env, { WHATSAPP_LOCAL_COUNTRY_CODE: "", WHATSAPP_PATIENT_THANK_YOU_LANGUAGE: "configured_locale", WHATSAPP_ACCESS_TOKEN: "mock-token", WHATSAPP_PHONE_NUMBER_ID: "mock-phone" });
  assert.equal(lisConfigurationError(input, "9876543210"), undefined);

  const storedPatient = { ...patient, mobile: "9876543210" };
  t.mock.method(LabBill, "findById", () => query(bill));
  t.mock.method(Patient, "findById", () => query(storedPatient));
  t.mock.method(LabSample, "find", () => query([]));
  t.mock.method(globalThis, "fetch", async () => ({ ok: true, json: async () => ({ name: "Configured Centre" }) }));
  const context = await loadLisContext(input, "Operator");
  assert.equal(context.mobile, "+919876543210");
  assert.equal(storedPatient.mobile, "9876543210");
  assert.equal(lisConfigurationError(input, context.mobile), undefined);
});

test("explicit submit rechecks canonical data, sends once and logs without downgrading webhook state", async (t) => {
  const { reviewLisMessage, sendLisReview } = await workflow;
  const { env } = await import("../../config/env.js");
  const original = { language: env.WHATSAPP_PATIENT_THANK_YOU_LANGUAGE, token: env.WHATSAPP_ACCESS_TOKEN, phone: env.WHATSAPP_PHONE_NUMBER_ID };
  Object.assign(env, { WHATSAPP_PATIENT_THANK_YOU_LANGUAGE: "configured_locale", WHATSAPP_ACCESS_TOKEN: "mock-token", WHATSAPP_PHONE_NUMBER_ID: "mock-phone" });
  t.after(() => Object.assign(env, { WHATSAPP_PATIENT_THANK_YOU_LANGUAGE: original.language, WHATSAPP_ACCESS_TOKEN: original.token, WHATSAPP_PHONE_NUMBER_ID: original.phone }));
  t.mock.method(LabBill, "findById", () => query(bill));
  t.mock.method(Patient, "findById", () => query(patient));
  t.mock.method(LabSample, "find", () => query([]));
  t.mock.method(AuditLog, "create", async () => ({}));
  t.mock.method(WhatsAppMessage, "updateOne", (_filter: unknown, update: { $set: Record<string, unknown> }) => {
    assert.equal(update.$set.billId, String(billId)); assert.equal(update.$set.status, undefined); return query({});
  });
  let sends = 0;
  t.mock.method(globalThis, "fetch", async (url: string | URL, options?: RequestInit) => {
    if (String(url).includes("graph.facebook.com")) {
      sends++;
      const payload = JSON.parse(String(options?.body));
      assert.equal(payload.template.name, "patient_thank_you");
      assert.equal(payload.template.language.code, "configured_locale");
      assert.equal(payload.template.components.length, 1);
      return { ok: true, json: async () => ({ messages: [{ id: "wamid.mock" }] }) };
    }
    return { ok: true, json: async () => ({ name: "Configured Centre" }) };
  });
  const req = { user: { id: String(new Types.ObjectId()), name: "Operator" }, cookies: {} } as unknown as Request;
  const review = await reviewLisMessage(input, req);
  assert.equal(sends, 0, "review must never send");
  const pending = sendLisReview(review.reviewId, req);
  await assert.rejects(sendLisReview(review.reviewId, req), /already in progress/);
  const result = await pending;
  assert.equal(result.metaMessageId, "wamid.mock");
  assert.deepEqual(await sendLisReview(review.reviewId, req), result);
  assert.equal(sends, 1);
});

test("Meta under-review rejection returns an actual error, logs failure, and never falls back", async (t) => {
  const { reviewLisMessage, sendLisReview } = await workflow;
  const { env } = await import("../../config/env.js");
  const original = { language: env.WHATSAPP_PATIENT_THANK_YOU_LANGUAGE, token: env.WHATSAPP_ACCESS_TOKEN, phone: env.WHATSAPP_PHONE_NUMBER_ID };
  Object.assign(env, { WHATSAPP_PATIENT_THANK_YOU_LANGUAGE: "configured_locale", WHATSAPP_ACCESS_TOKEN: "mock-token", WHATSAPP_PHONE_NUMBER_ID: "mock-phone" });
  t.after(() => Object.assign(env, { WHATSAPP_PATIENT_THANK_YOU_LANGUAGE: original.language, WHATSAPP_ACCESS_TOKEN: original.token, WHATSAPP_PHONE_NUMBER_ID: original.phone }));
  t.mock.method(LabBill, "findById", () => query(bill));
  t.mock.method(Patient, "findById", () => query(patient));
  t.mock.method(LabSample, "find", () => query([]));
  let failure: { action: string; details?: Record<string, unknown> } | undefined;
  t.mock.method(AuditLog, "create", async (entry: typeof failure) => { failure = entry; return {}; });
  let sends = 0;
  t.mock.method(globalThis, "fetch", async (url: string | URL) => {
    if (String(url).includes("graph.facebook.com")) {
      sends++; return { ok: false, status: 400, json: async () => ({ error: { message: "Template is pending approval", code: 132001 } }) };
    }
    return { ok: true, json: async () => ({ name: "Configured Centre" }) };
  });
  const req = { user: { id: String(new Types.ObjectId()), name: "Operator" }, cookies: {} } as unknown as Request;
  const review = await reviewLisMessage(input, req);
  await assert.rejects(sendLisReview(review.reviewId, req), /pending approval.*No fallback template/);
  assert.match(String(failure?.details?.errorMessage), /pending approval/);
  assert.equal(failure?.details?.billId, String(billId));
  await assert.rejects(sendLisReview(review.reviewId, req), /already in progress or has been attempted/);
  assert.equal(sends, 1);
});

test("renderer failure deletes its job; retry prepares one attachment without sending", async (t) => {
  const { reviewLisMessage, findLisReview } = await workflow;
  const { chromium } = await import("playwright");
  t.mock.method(LabBill, "findById", () => query(bill));
  t.mock.method(Patient, "findById", () => query(patient));
  t.mock.method(LabSample, "find", () => query([]));
  let providerCalls = 0;
  t.mock.method(globalThis, "fetch", async (url: URL | string) => {
    if (String(url).includes("graph.facebook")) { providerCalls++; throw new Error("Must not send"); }
    return new Response(JSON.stringify({ name: "Configured centre" }), { headers: { "Content-Type": "application/json" } });
  });
  let fail = true; let failedReviewId = "";
  const page = {
    goto: async (url: string) => { failedReviewId = new URL(url).searchParams.get("reviewId")!; if (fail) throw new Error("Simulated renderer network failure"); },
    locator: () => ({ waitFor: async () => {} }), evaluate: async () => {}, emulateMedia: async () => {},
    addStyleTag: async () => {}, pdf: async () => Buffer.from("%PDF-1.4\nunit fixture only"),
  };
  t.mock.method(chromium, "launch", async () => ({
    newContext: async () => ({ addCookies: async () => {}, route: async () => {}, newPage: async () => page }), close: async () => {},
  }));
  const req = { user: { id: "review-owner", name: "Operator" }, cookies: { diagnostic_token: "test-only" } } as unknown as Request;
  const invoice = { ...input, templateName: "lab_invoice_ready" as const };
  await assert.rejects(reviewLisMessage(invoice, req), /document page loading/);
  assert.throws(() => findLisReview(failedReviewId, "review-owner"), /expired/);
  fail = false;
  const reviewed = await reviewLisMessage(invoice, req);
  assert.equal(reviewed.attachment?.mimeType, "application/pdf");
  assert.equal(findLisReview(reviewed.reviewId, "review-owner").state, "review");
  assert.equal(providerCalls, 0);
  const greeting = await reviewLisMessage(input, req);
  assert.equal(greeting.attachment, null);
});

test("explicit Meta 131049 rejection is failed, keeps the code/exact text, and cannot be resubmitted", async (t) => {
  const { reviewLisMessage, sendLisReview } = await workflow;
  const { env } = await import("../../config/env.js");
  const original = { language: env.WHATSAPP_PATIENT_THANK_YOU_LANGUAGE, token: env.WHATSAPP_ACCESS_TOKEN, phone: env.WHATSAPP_PHONE_NUMBER_ID };
  Object.assign(env, { WHATSAPP_PATIENT_THANK_YOU_LANGUAGE: "configured_locale", WHATSAPP_ACCESS_TOKEN: "mock-token", WHATSAPP_PHONE_NUMBER_ID: "mock-phone" });
  t.after(() => Object.assign(env, { WHATSAPP_PATIENT_THANK_YOU_LANGUAGE: original.language, WHATSAPP_ACCESS_TOKEN: original.token, WHATSAPP_PHONE_NUMBER_ID: original.phone }));
  t.mock.method(LabBill, "findById", () => query(bill));
  t.mock.method(Patient, "findById", () => query(patient));
  t.mock.method(LabSample, "find", () => query([]));
  let failure: { details?: Record<string, unknown> } | undefined;
  t.mock.method(AuditLog, "create", async (data: typeof failure) => { failure = data; return {}; });
  let sends = 0;
  t.mock.method(globalThis, "fetch", async (url: string | URL) => {
    if (String(url).includes("graph.facebook.com")) { sends++; return new Response(JSON.stringify({ error: { code: 131049, message: "Engagement restriction" } }), { status: 400 }); }
    return new Response(JSON.stringify({ name: "Configured Centre" }));
  });
  const req = { user: { id: String(new Types.ObjectId()), name: "Operator" }, cookies: {} } as unknown as Request;
  const reviewed = await reviewLisMessage(input, req);
  await assert.rejects(sendLisReview(reviewed.reviewId, req), (error: any) => {
    assert.equal(error.message, "Meta did not deliver this message because of its messaging engagement restrictions. Wait before trying again.");
    assert.equal(error.details.metaErrorCode, "131049"); return true;
  });
  assert.equal(failure?.details?.status, "failed"); assert.equal(failure?.details?.errorCode, "131049");
  await assert.rejects(sendLisReview(reviewed.reviewId, req), /already in progress or has been attempted/);
  assert.equal(sends, 1);
});
