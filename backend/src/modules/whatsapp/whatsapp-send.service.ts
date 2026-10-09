import { ENGAGEMENT_FAILURE, maskedRecipient } from "./lis-delivery.service";
import { env } from "../../config/env";
import { ApiError } from "../../utils/api-error";

/**
 * Outbound WhatsApp Cloud API (Meta) sending.
 *
 * Server-side only: the access token is read from the environment and is never
 * logged, returned to callers, or exposed to the frontend.
 *
 * This file is independent of `whatsapp.service.ts` (the inbound webhook) so the
 * working webhook implementation is left completely untouched.
 */

const LOG_PREFIX = "[WhatsApp]";
const GRAPH_BASE_URL = "https://graph.facebook.com";

export interface SendWhatsAppTemplateMessageInput {
  /** Destination in international format; "+", spaces and dashes are ignored. */
  to: string;
  templateName: string;
  languageCode: string;
  /** Meta template components (header/body/button parameters), passed through. */
  components?: unknown[];
}

export interface SendWhatsAppTemplateMessageResult {
  /** Meta's message id (`wamid…`) — the id the webhook matches statuses on. */
  metaMessageId: string;
  /** The recipient WhatsApp id Meta echoes back, when present. */
  waId?: string;
}

interface MetaSendResponse {
  messages?: { id?: string }[];
  contacts?: { wa_id?: string }[];
  error?: { message?: string; type?: string; code?: number };
}

/**
 * Strips formatting and enforces a plausible E.164 destination.
 * Throws a 422 `ApiError` for anything that cannot be a phone number, so a bad
 * destination never reaches the Meta API.
 */
export function normalizeWhatsAppRecipient(raw: string): string {
  const digits = (raw ?? "").replace(/\D/g, "");

  if (digits.length < 10 || digits.length > 15) {
    throw new ApiError(
      422,
      "A valid destination phone number in international format (10-15 digits) is required.",
    );
  }

  return digits;
}

/**
 * Sends a single WhatsApp template message through the Meta Cloud API.
 *
 * All credentials come from the environment (`.env` locally, Render environment
 * variables in production) — nothing is hardcoded, and no secret is logged.
 */
export async function sendWhatsAppTemplateMessage(
  input: SendWhatsAppTemplateMessageInput,
): Promise<SendWhatsAppTemplateMessageResult> {
  const accessToken = env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    throw new ApiError(
      503,
      "WhatsApp Cloud API is not configured (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID missing).",
    );
  }

  const to = normalizeWhatsAppRecipient(input.to);
  const templateName = input.templateName.trim();
  const languageCode = input.languageCode.trim();

  if (!templateName || !languageCode) {
    throw new ApiError(422, "templateName and languageCode are required.");
  }

  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(input.components && input.components.length > 0
        ? { components: input.components }
        : {}),
    },
  };

  const url = `${GRAPH_BASE_URL}/${env.WHATSAPP_GRAPH_VERSION}/${phoneNumberId}/messages`;

  console.log(
    `${LOG_PREFIX} Sending template message (template=${templateName}, language=${languageCode})`,
  );

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        // Value is the access token; it is never logged.
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const body = (await response.json().catch(() => null)) as
      | MetaSendResponse
      | null;

    if (!response.ok) {
      const reason = body?.error?.message ?? `HTTP ${response.status}`;
      const code = body?.error?.code;
      console.warn(
        `${LOG_PREFIX} Meta rejected the message (status=${response.status}${
          code !== undefined ? `, code=${code}` : ""
        }): ${reason}`,
      );
      throw new ApiError(502, code === 131049 ? ENGAGEMENT_FAILURE : `WhatsApp send failed: ${reason}`, code === undefined ? undefined : { metaErrorCode: String(code) });
    }

    const metaMessageId = body?.messages?.[0]?.id;
    if (!metaMessageId) {
      console.warn(
        `${LOG_PREFIX} Meta response did not include a message id`,
      );
      throw new ApiError(
        502,
        "WhatsApp send failed: Meta did not return a message id.",
      );
    }

    console.log(LOG_PREFIX, { templateName, languageCode, metaMessageId, recipient: maskedRecipient(to), status: "accepted" });

    return { metaMessageId, waId: body?.contacts?.[0]?.wa_id };
  } catch (error) {
    // ApiError from the checks above is already safe to surface.
    if (error instanceof ApiError) throw error;

    console.error(
      `${LOG_PREFIX} Network error contacting Meta:`,
      error instanceof Error ? error.message : error,
    );
    throw new ApiError(
      502,
      "Could not reach the WhatsApp Cloud API. Please try again.",
    );
  }
}
