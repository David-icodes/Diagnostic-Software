import { test } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { WhatsAppMessage } from "../../models/whatsapp-message.model";
import { LabBill } from "../../models/lab-bill.model";
import { deliveryMessage, maskedRecipient, listLisDelivery } from "./lis-delivery.service";
process.env.MONGODB_URI = "mongodb://127.0.0.1/no_connection";
process.env.JWT_SECRET = "unit-test-only-no-deployment-secret";
const webhook = import("./whatsapp.service.js");

test("131049 is explained as failed delivery without retry, and success states remain distinct", () => {
  assert.match(deliveryMessage("failed", "131049"), /Meta did not deliver/);
  assert.equal(deliveryMessage("failed", "131049"), "Meta did not deliver this message because of its messaging engagement restrictions. Wait before trying again.");
  assert.equal(new Set(["accepted", "sent", "delivered", "read", "failed"].map((status) => deliveryMessage(status))).size, 5);
  assert.equal(maskedRecipient("919876543210"), "***3210");
});

test("webhook records failed status and 131049; duplicate/late successes cannot overwrite it or resend", async (t) => {
  const { handleWebhookPayload } = await webhook;
  let row: Record<string, any> = { metaMessageId: "wamid.test", templateName: "patient_thank_you", workflow: "lab-reprint", status: "accepted" };
  t.mock.method(globalThis, "fetch", () => { throw new Error("Webhook must never send or retry"); });
  t.mock.method(WhatsAppMessage, "findOneAndUpdate", async (filter: any, update: any) => {
    if (filter.status.$nin.includes(row.status)) throw Object.assign(new Error("duplicate"), { code: 11000 });
    Object.assign(row, update.$set); return row;
  });
  const event = (status: string, errors?: unknown[]) => ({ entry: [{ changes: [{ value: {
    metadata: { display_phone_number: "business-number" }, statuses: [{ id: "wamid.test", status, recipient_id: "919876543210", timestamp: "1791528000", errors }],
  } }] }] });
  await handleWebhookPayload(event("sent")); assert.equal(row.status, "sent");
  await handleWebhookPayload(event("failed", [{ code: 131049, title: "Engagement protection", error_data: { details: "Meta declined delivery" } }]));
  assert.equal(row.status, "failed"); assert.equal(row.errorCode, "131049"); assert.ok(row.failedAt);
  assert.equal(row.phoneNumber, "919876543210"); assert.equal(row.deliveredAt, undefined);
  for (const status of ["delivered", "read", "sent", "failed"]) await handleWebhookPayload(event(status));
  assert.equal(row.status, "failed"); assert.equal(row.deliveredAt, undefined);
  row = { metaMessageId: "wamid.test", status: "accepted" };
  for (const status of ["sent", "delivered", "read", "sent", "failed"]) await handleWebhookPayload(event(status));
  assert.equal(row.status, "read");
});

test("delivery history is bill-scoped, hides patient/recipient content and explains historical failures", async (t) => {
  const billId = String(new Types.ObjectId());
  t.mock.method(LabBill, "exists", async () => ({ _id: billId }));
  const row = { metaMessageId: "wamid.failed", templateName: "patient_thank_you", templateLanguage: "en", status: "failed", errorCode: "131049", phoneNumber: "private", textBody: "private clinical data" };
  const q = { select: () => q, sort: () => q, limit: () => q, lean: () => q, exec: async () => [row] };
  t.mock.method(WhatsAppMessage, "find", (filter: any) => { assert.equal(filter.billId, billId); assert.equal(filter.direction, "OUTBOUND"); return q; });
  const history = await listLisDelivery(billId);
  assert.equal(history[0].status, "failed"); assert.equal(history[0].workflow, "unknown");
  assert.match(history[0].message, /Meta did not deliver/);
  assert.equal("phoneNumber" in history[0], false); assert.equal("textBody" in history[0], false);
});
test("legacy report_ready retains its exact no-variable outgoing payload", async (t) => {
  const { env } = await import("../../config/env.js");
  const original = { token: env.WHATSAPP_ACCESS_TOKEN, phone: env.WHATSAPP_PHONE_NUMBER_ID };
  Object.assign(env, { WHATSAPP_ACCESS_TOKEN: "unit-only-token", WHATSAPP_PHONE_NUMBER_ID: "unit-only-phone" });
  t.after(() => Object.assign(env, { WHATSAPP_ACCESS_TOKEN: original.token, WHATSAPP_PHONE_NUMBER_ID: original.phone }));
  const { sendWhatsAppTemplateMessage } = await import("./whatsapp-send.service.js");
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (_url: unknown, options: any) => {
    calls++; assert.deepEqual(JSON.parse(options.body), {
      messaging_product: "whatsapp", recipient_type: "individual", to: "919876543210", type: "template",
      template: { name: "report_ready", language: { code: "en" } },
    });
    return new Response(JSON.stringify({ messages: [{ id: "wamid.legacy-mock" }] }));
  });
  assert.equal((await sendWhatsAppTemplateMessage({ to: "+919876543210", templateName: "report_ready", languageCode: "en" })).metaMessageId, "wamid.legacy-mock");
  assert.equal(calls, 1);
});

test("synchronous Meta 131049 response preserves the code and exact failure explanation without retry", async (t) => {
  const { env } = await import("../../config/env.js");
  const original = { token: env.WHATSAPP_ACCESS_TOKEN, phone: env.WHATSAPP_PHONE_NUMBER_ID };
  Object.assign(env, { WHATSAPP_ACCESS_TOKEN: "unit-only-token", WHATSAPP_PHONE_NUMBER_ID: "unit-only-phone" });
  t.after(() => Object.assign(env, { WHATSAPP_ACCESS_TOKEN: original.token, WHATSAPP_PHONE_NUMBER_ID: original.phone }));
  const { sendWhatsAppTemplateMessage } = await import("./whatsapp-send.service.js");
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; return new Response(JSON.stringify({ error: { code: 131049, message: "Meta chose not to deliver" } }), { status: 400 }); });
  await assert.rejects(sendWhatsAppTemplateMessage({ to: "+919876543210", templateName: "patient_thank_you", languageCode: "en" }), (error: any) => {
    assert.equal(error.message, "Meta did not deliver this message because of its messaging engagement restrictions. Wait before trying again.");
    assert.equal(error.details.metaErrorCode, "131049"); return true;
  });
  assert.equal(calls, 1);
});
