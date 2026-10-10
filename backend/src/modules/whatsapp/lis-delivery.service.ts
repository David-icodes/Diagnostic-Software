import { Types } from "mongoose";
import { LabBill } from "../../models/lab-bill.model";
import { WhatsAppMessage } from "../../models/whatsapp-message.model";
import { ApiError } from "../../utils/api-error";

export const ENGAGEMENT_FAILURE = "Meta did not deliver this message because of its messaging engagement restrictions. Wait before trying again.";
export function maskedRecipient(value?: string) { return value ? `***${value.slice(-4)}` : "unknown"; }
export function deliveryMessage(status: string, errorCode?: string) {
  if (status === "failed") return errorCode === "131049" ? ENGAGEMENT_FAILURE : "Meta reported that this message failed delivery. No automatic resend will be made.";
  return { accepted: "Accepted by Meta; delivery is not yet confirmed.", sent: "Sent by Meta; delivery is not yet confirmed.", delivered: "Delivered to the recipient.", read: "Read by the recipient." }[status] ?? "Delivery status is unavailable.";
}
export async function listLisDelivery(billId: string) {
  if (!Types.ObjectId.isValid(billId)) throw new ApiError(400, "Invalid bill ID");
  if (!await LabBill.exists({ _id: billId })) throw new ApiError(404, "Bill not found");
  const rows = await WhatsAppMessage.find({ billId, direction: "OUTBOUND" })
    .select("metaMessageId templateName templateLanguage workflow status errorCode createdAt")
    .sort({ createdAt: -1 }).limit(10).lean().exec();
  return rows.map((row) => ({ metaMessageId: row.metaMessageId, templateName: row.templateName ?? "Unknown template",
    languageCode: row.templateLanguage, workflow: row.workflow ?? "unknown", status: row.status,
    errorCode: row.errorCode, message: deliveryMessage(row.status, row.errorCode), createdAt: row.createdAt }));
}