import { api } from "@/lib/api";

/**
 * Meta template component shapes used by this app.
 *
 * The approved templates only use body variables, e.g. `report_ready`'s
 * `{{1}}` is supplied as a single text parameter of the body component.
 */
export interface WhatsAppTemplateTextParameter {
  type: "text";
  text: string;
}

export interface WhatsAppTemplateBodyComponent {
  type: "body";
  parameters: WhatsAppTemplateTextParameter[];
}

export type WhatsAppTemplateComponent = WhatsAppTemplateBodyComponent;

export interface WhatsAppTestInput {
  to: string;
  templateName: string;
  languageCode: string;
  /** Template components, e.g. the body parameter for a `{{1}}` variable. */
  components?: WhatsAppTemplateComponent[];
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
