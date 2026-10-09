import { maskedRecipient } from "./lis-delivery.service";
import crypto from "node:crypto";
import { env } from "../../config/env";
import { WhatsAppMessage } from "../../models/whatsapp-message.model";

/**
 * WhatsApp Cloud API webhook processing.
 *
 * The webhook is deliberately tolerant: Meta payloads vary by event type and a
 * malformed or unexpected event must never throw out of the route. Every item is
 * parsed defensively, and a processing failure is logged and swallowed so the
 * endpoint can always acknowledge Meta with 200 and Meta does not retry forever.
 *
 * Nothing here logs secrets, access tokens or medical content.
 */

const LOG_PREFIX = "[WhatsApp Webhook]";

/** Delivery order used to stop an out-of-order duplicate downgrading a status. */
const STATUS_RANK: Record<string, number> = {
  accepted: 0,
  sent: 1,
  delivered: 2,
  read: 3,
};

type Json = Record<string, unknown>;

function asRecord(value: unknown): Json | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return undefined;
}

function toDate(value: unknown): Date | undefined {
  // Meta timestamps are Unix seconds (as a string).
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
  return new Date(seconds * 1000);
}

function isDuplicateKeyError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: number }).code === 11000);
}

export interface WebhookChallengeResult {
  status: number;
  body: string;
}

/**
 * Meta's GET verification handshake.
 *
 * Returns the `hub.challenge` with 200 when `hub.mode` is `subscribe` and the
 * token matches `WHATSAPP_VERIFY_TOKEN`; otherwise 403. The token is read from
 * the environment and is never hardcoded.
 */
export function verifyWebhookSubscription(query: {
  "hub.mode"?: unknown;
  "hub.verify_token"?: unknown;
  "hub.challenge"?: unknown;
}): WebhookChallengeResult {
  const mode = asString(query["hub.mode"]);
  const token = asString(query["hub.verify_token"]);
  const challenge = asString(query["hub.challenge"]);
  const expected = env.WHATSAPP_VERIFY_TOKEN;

  if (!expected) {
    console.error(
      `${LOG_PREFIX} WHATSAPP_VERIFY_TOKEN is not configured; verification rejected`,
    );
    return { status: 403, body: "Forbidden" };
  }

  if (mode !== "subscribe" || !token || token !== expected) {
    console.warn(`${LOG_PREFIX} Verification failed (mode=${mode ?? "none"})`);
    return { status: 403, body: "Forbidden" };
  }

  console.log(`${LOG_PREFIX} Verification succeeded`);
  return { status: 200, body: challenge ?? "" };
}

/**
 * Verifies Meta's `X-Hub-Signature-256` over the exact raw request body.
 *
 * When `WHATSAPP_APP_SECRET` is not configured the check is skipped (logged once
 * per call) so the webhook still works locally before the secret is set. The
 * comparison is constant-time.
 */
export function verifyWebhookSignature(
  rawBody: Buffer | undefined,
  signatureHeader: string | undefined,
): boolean {
  const secret = env.WHATSAPP_APP_SECRET;
  if (!secret) {
    console.warn(`${LOG_PREFIX} WHATSAPP_APP_SECRET not set — signature check skipped`);
    return true;
  }
  if (!rawBody || !signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = signatureHeader.slice("sha256=".length);
  const expectedBuffer = Buffer.from(expected, "hex");
  let providedBuffer: Buffer;
  try {
    providedBuffer = Buffer.from(provided, "hex");
  } catch {
    return false;
  }
  return (
    expectedBuffer.length === providedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, providedBuffer)
  );
}

/**
 * Processes a webhook payload: message status updates (`statuses[]`) and inbound
 * messages (`messages[]`). Safe to call with any shape; unknown events are logged
 * and skipped. Never throws.
 */
export async function handleWebhookPayload(payload: unknown): Promise<void> {
  const root = asRecord(payload);
  const entries = root ? asArray(root.entry) : [];

  if (!root || !Array.isArray(root.entry)) {
    console.warn(`${LOG_PREFIX} Unrecognized payload (no entry[])`);
    return;
  }

  for (const entry of entries) {
    const changes = asArray(asRecord(entry)?.changes);
    for (const change of changes) {
      const value = asRecord(asRecord(change)?.value);
      if (!value) continue;
      const metadata = asRecord(value.metadata) ?? {};
      const contacts = asArray(value.contacts);

      for (const status of asArray(value.statuses)) {
        await safe(() => handleStatus(metadata, asRecord(status)));
      }
      for (const message of asArray(value.messages)) {
        await safe(() => handleIncoming(metadata, contacts, asRecord(message)));
      }
    }
  }
}

async function safe(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    console.error(
      `${LOG_PREFIX} Failed to process event:`,
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * Runs tasks that share a key one after another, so webhook events for the same
 * Meta message are applied in arrival order within this process.
 */
const pendingByKey = new Map<string, Promise<void>>();

function serialize(key: string, task: () => Promise<void>): Promise<void> {
  const previous = pendingByKey.get(key) ?? Promise.resolve();
  const next = previous.then(task).catch((error) => {
    console.error(LOG_PREFIX, { metaMessageId: key, persistenceFailed: true, errorType: error instanceof Error ? error.name : "Unknown" });
  });
  pendingByKey.set(key, next);
  void next.finally(() => {
    if (pendingByKey.get(key) === next) pendingByKey.delete(key);
  });
  return next;
}

/**
 * Statuses at or beyond `next`. The stored status must not be in this list for
 * the update to apply, which is how a duplicate/older event is rejected.
 * `failed` is treated as terminal and never overwritten by a success status.
 */
function blockedStatusesFor(next: string): string[] {
  if (next === "failed") return ["delivered", "read", "failed"];
  const rank = STATUS_RANK[next];
  if (rank === undefined) return ["failed"];
  return [
    ...Object.keys(STATUS_RANK).filter((status) => STATUS_RANK[status] >= rank),
    "failed",
  ];
}

async function handleStatus(metadata: Json, status: Json | null): Promise<void> {
  if (!status) return;
  const metaMessageId = asString(status.id);
  const state = asString(status.status);
  if (!metaMessageId || !state || !["sent", "delivered", "read", "failed"].includes(state)) return;

  const recipient = asString(status.recipient_id);
  const timestamp = toDate(status.timestamp);
  const errors = asArray(status.errors)
    .map(asRecord)
    .filter((value): value is Json => value !== null);
  const firstError = errors[0];
  const errorCode = firstError ? asString(firstError.code) : undefined;
  const errorTitle = firstError ? asString(firstError.title) : undefined;
  const errorMessage =
    firstError && asRecord(firstError.error_data)
      ? asString(asRecord(firstError.error_data)?.details)
      : undefined;

  const conversation = asRecord(status.conversation) ?? undefined;
  const pricing = asRecord(status.pricing) ?? undefined;
  void metadata;

  // Events for one message are serialised in arrival order, then applied with a
  // filter that refuses to move the status backwards — so a duplicate or late
  // event (e.g. "delivered" arriving after "read") can never downgrade the row.
  await serialize(metaMessageId, async () => {
    const setFields: Record<string, unknown> = { status: state };
    if (timestamp) setFields.metaTimestamp = timestamp;
    Object.assign(setFields, timestampFor(state, timestamp));
    if (state === "failed") {
      setFields.failedAt = timestamp ?? new Date();
      if (errorCode) setFields.errorCode = errorCode;
      if (errorTitle) setFields.errorTitle = errorTitle;
      if (errorMessage) setFields.errorMessage = errorMessage;
    }
    if (recipient) setFields.waId = recipient;
    if (recipient) setFields.phoneNumber = recipient;
    if (conversation) setFields.conversation = conversation;
    if (pricing) setFields.pricing = pricing;

    try {
      const stored = await WhatsAppMessage.findOneAndUpdate(
        { metaMessageId, status: { $nin: blockedStatusesFor(state) } },
        {
          $set: setFields,
          $setOnInsert: { direction: "OUTBOUND", messageType: "status" },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      console.log(LOG_PREFIX, { metaMessageId, templateName: stored?.templateName ?? "unknown", workflow: stored?.workflow ?? "unknown", recipient: maskedRecipient(recipient), eventStatus: state, storedStatus: stored?.status ?? "unchanged", errorCode });
    } catch (error) {
      // The unique index rejected the insert: a row already exists at an equal
      // or more advanced status, which is exactly what we wanted to preserve.
      if (!isDuplicateKeyError(error)) throw error;
      console.log(LOG_PREFIX, { metaMessageId, eventStatus: state, applied: false, reason: "existing terminal or more advanced status" });
    }
  });
}

function timestampFor(
  state: string,
  at: Date | undefined,
): Record<string, Date> {
  if (!at) return {};
  if (state === "sent") return { sentAt: at };
  if (state === "delivered") return { deliveredAt: at };
  if (state === "read") return { readAt: at };
  return {};
}

async function handleIncoming(
  _metadata: Json,
  contacts: unknown[],
  message: Json | null,
): Promise<void> {
  if (!message) return;
  const metaMessageId = asString(message.id);
  const from = asString(message.from);
  if (!metaMessageId) return;

  const type = asString(message.type) ?? "unknown";
  const timestamp = toDate(message.timestamp);
  const text = asString(asRecord(message.text)?.body);
  const contact = contacts
    .map(asRecord)
    .find((value): value is Json => value !== null && asString(value.wa_id) === from);
  const contactName = contact ? asString(asRecord(contact.profile)?.name) : undefined;

  console.log(`${LOG_PREFIX} Incoming message from ${from ?? "unknown"} (type ${type})`);

  // $setOnInsert keeps this idempotent: a redelivered message adds nothing.
  await WhatsAppMessage.updateOne(
    { metaMessageId },
    {
      $setOnInsert: {
        direction: "INBOUND",
        metaMessageId,
        status: "received",
        ...(from ? { waId: from, phoneNumber: from } : {}),
        ...(contactName ? { contactName } : {}),
        messageType: type,
        ...(text ? { textBody: text } : {}),
        ...(timestamp ? { metaTimestamp: timestamp } : {}),
      },
    },
    { upsert: true },
  );
}
