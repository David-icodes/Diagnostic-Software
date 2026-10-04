import { model, Schema, type Types } from "mongoose";
import { PAYMENT_MODES, type PaymentMode } from "./lab-bill.model";

export interface ILabBillPayment {
  billId: Types.ObjectId;
  amount: number;
  discountAmount?: number;
  paymentMode: PaymentMode;
  comments?: string;
  collectedAt: Date;
  collectedBy: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const labBillPaymentSchema = new Schema<ILabBillPayment>(
  {
    billId: { type: Schema.Types.ObjectId, ref: "LabBill", required: true, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    discountAmount: { type: Number, min: 0, default: 0 },
    paymentMode: { type: String, enum: PAYMENT_MODES, required: true, default: "cash" },
    comments: { type: String, trim: true, maxlength: 500 },
    collectedAt: { type: Date, required: true, default: Date.now, index: true },
    collectedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
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

labBillPaymentSchema.index({ billId: 1, collectedAt: -1 });

export const LabBillPayment = model<ILabBillPayment>(
  "LabBillPayment",
  labBillPaymentSchema,
);