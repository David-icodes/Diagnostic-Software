import { model, Schema, type Types } from "mongoose";

/**
 * A WhatsApp message, its delivery lifecycle, or an inbound message.
 *
 * One collection covers both directions so a report sent to a patient and the
 * patient's reply can be read together. `metaMessageId` (Meta's `wamid…`) is the
 * identity the webhook is matched on, so a repeated status event updates the
 * same document instead of inserting a duplicate.
 *
 * No clinical/medical content is stored here beyond an optional report link —
 * only delivery metadata, the patient/report identifiers and (for inbound) the
 * message text.
 */
export type WhatsAppMessageDirection = "OUTBOUND" | "INBOUND";
export const WHATSAPP_MESSAGE_DIRECTIONS: WhatsAppMessageDirection[] = [
  "OUTBOUND",
  "INBOUND",
];

export type WhatsAppMessageStatus =
  | "accepted"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "received";
export const WHATSAPP_MESSAGE_STATUSES: WhatsAppMessageStatus[] = [
  "accepted",
  "sent",
  "delivered",
  "read",
  "failed",
  "received",
];

export interface IWhatsAppMessage {
  direction: WhatsAppMessageDirection;
  /** Meta message id (`wamid…`). Unique: the webhook's idempotency key. */
  metaMessageId: string;
  /** The other party's WhatsApp id (recipient for outbound, sender for inbound). */
  waId?: string;
  phoneNumber?: string;
  /** WhatsApp profile name when the payload provides one. */
  contactName?: string;
  /** template | text | image | document | … */
  messageType?: string;
  templateName?: string;
  templateLanguage?: string;
  /** Inbound text body. */
  textBody?: string;
  status: WhatsAppMessageStatus;
  errorCode?: string;
  errorTitle?: string;
  errorMessage?: string;
  /** Meta conversation object (id, category, expiry) when present. */
  conversation?: Record<string, unknown>;
  /** Meta pricing object (category, pricing model) when present. */
  pricing?: Record<string, unknown>;
  /** Optional links to the LIS entities this message concerns. */
  patientId?: Types.ObjectId;
  reportId?: Types.ObjectId;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  failedAt?: Date;
  /** The event time Meta sent (epoch seconds decoded), when provided. */
  metaTimestamp?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const whatsappMessageSchema = new Schema<IWhatsAppMessage>(
  {
    direction: {
      type: String,
      enum: WHATSAPP_MESSAGE_DIRECTIONS,
      required: true,
      default: "OUTBOUND",
    },
    metaMessageId: { type: String, required: true, trim: true },
    waId: { type: String, trim: true },
    phoneNumber: { type: String, trim: true },
    contactName: { type: String, trim: true, maxlength: 120 },
    messageType: { type: String, trim: true, maxlength: 40 },
    templateName: { type: String, trim: true, maxlength: 120 },
    templateLanguage: { type: String, trim: true, maxlength: 20 },
    textBody: { type: String, trim: true, maxlength: 4096 },
    status: {
      type: String,
      enum: WHATSAPP_MESSAGE_STATUSES,
      required: true,
    },
    errorCode: { type: String, trim: true, maxlength: 40 },
    errorTitle: { type: String, trim: true, maxlength: 200 },
    errorMessage: { type: String, trim: true, maxlength: 1000 },
    conversation: { type: Schema.Types.Mixed },
    pricing: { type: Schema.Types.Mixed },
    patientId: { type: Schema.Types.ObjectId, ref: "Patient" },
    reportId: { type: Schema.Types.ObjectId },
    sentAt: { type: Date },
    deliveredAt: { type: Date },
    readAt: { type: Date },
    failedAt: { type: Date },
    metaTimestamp: { type: Date },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform(_doc: unknown, ret: Record<string, unknown>) {
        ret.id = String(ret._id);
        delete ret._id;
        return ret;
      },
    },
  },
);

// Idempotency: a repeated webhook event for the same Meta message matches here.
whatsappMessageSchema.index({ metaMessageId: 1 }, { unique: true });
whatsappMessageSchema.index({ status: 1, createdAt: -1 });
whatsappMessageSchema.index({ waId: 1, createdAt: -1 });

export const WhatsAppMessage = model<IWhatsAppMessage>(
  "WhatsAppMessage",
  whatsappMessageSchema,
);
