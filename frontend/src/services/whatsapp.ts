import { api } from "@/lib/api";

export interface WhatsAppTestInput {
  to: string;
  templateName: string;
  languageCode: string;
}

export interface WhatsAppTestResult {
  metaMessageId: string;
  waId: string;
  templateName: string;
  languageCode: string;
}

/**
 * Temporary admin-only outbound WhatsApp test (`POST /api/whatsapp/test-message`).
 *
 * The route is mounted at the API origin, outside `/api/v1`, next to the Meta
 * webhook — so it goes through `api.postFromOrigin`, which is the ordinary
 * authenticated client (envelope + `credentials: "include"`). Never call it
 * with a bare `fetch`: without credentials the session cookie is omitted and
 * the server answers 401.
 *
 * The Meta access token stays server-side; the response carries only the
 * message id and the waId.
 */
export function sendWhatsAppTestMessage(
  input: WhatsAppTestInput,
): Promise<WhatsAppTestResult> {
  return api.postFromOrigin<WhatsAppTestResult>(
    "/api/whatsapp/test-message",
    input,
  );
}
