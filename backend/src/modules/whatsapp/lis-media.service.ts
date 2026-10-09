import { env } from "../../config/env";
import { ApiError } from "../../utils/api-error";

/** Upload the actual generated PDF privately; no public patient document URL. */
export async function uploadLisPdf(pdf: Buffer, filename: string): Promise<string> {
  if (!pdf.subarray(0, 5).equals(Buffer.from("%PDF-")) || pdf.length > 16 * 1024 * 1024) {
    throw new ApiError(422, "The generated PDF is invalid or exceeds the attachment limit");
  }
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", "application/pdf");
  form.append("file", new Blob([new Uint8Array(pdf)], { type: "application/pdf" }), filename);
  try {
    const response = await fetch(`https://graph.facebook.com/${env.WHATSAPP_GRAPH_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/media`, {
      method: "POST", headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` },
      body: form, signal: AbortSignal.timeout(30000),
    });
    const data = await response.json() as { id?: string; error?: { message?: string } };
    if (!response.ok || !data.id) throw new ApiError(502, `WhatsApp PDF upload failed: ${data.error?.message ?? "Meta did not return a media ID"}`);
    return data.id;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, "Could not upload the generated PDF to WhatsApp");
  }
}
