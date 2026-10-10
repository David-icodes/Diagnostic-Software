import { model, Schema, type Types } from "mongoose";

export type PatientType = "osp" | "op" | "ip" | "emergency" | "corporate";
export type PaymentMode = "cash" | "upi" | "card" | "bank_transfer" | "other";
export type BillStatus = "draft" | "generated" | "cancelled";
export type BillType = "osp" | "vendor";

export interface IBillItem {
  testId: Types.ObjectId;
  testCode: string;
  testName: string;
  departmentId: Types.ObjectId;
  departmentName: string;
  unitPrice: number;
  quantity: number;
  total: number;
  outsideLabId?: Types.ObjectId | null;
  outsideLabName?: string;
  sentOutAt?: Date | null;
}

export interface ILabBill {
  billNumber: string;
  billType: BillType;
  patientId: Types.ObjectId;
  patientType: PatientType;
  visitId?: Types.ObjectId;
  clientId?: Types.ObjectId;
  clientName?: string;
  referringDoctorId?: Types.ObjectId;
  doctorName?: string;
  items: IBillItem[];
  totalAmount: number;
  discountPercent: number;
  discountAmount: number;
  netAmount: number;
  paidAmount: number;
  dueAmount: number;
  paymentMode: PaymentMode;
  comments?: string;
  displayComments?: string;
  status: BillStatus;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  cancelledAt?: Date;
  cancelledBy?: Types.ObjectId;
  cancellationRemarks?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export const PATIENT_TYPES: PatientType[] = ["osp", "op", "ip", "emergency", "corporate"];
export const PAYMENT_MODES: PaymentMode[] = ["cash", "upi", "card", "bank_transfer", "other"];
export const BILL_STATUSES: BillStatus[] = ["draft", "generated", "cancelled"];
export const BILL_CREATION_STATUSES = ["draft", "generated"] as const;
export const BILL_TYPES: BillType[] = ["osp", "vendor"];

const billItemSchema = new Schema<IBillItem>(
  {
    testId: { type: Schema.Types.ObjectId, ref: "LabTest", required: true },
    testCode: { type: String, required: true, trim: true },
    testName: { type: String, required: true, trim: true },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true },
    departmentName: { type: String, required: true, trim: true },
    unitPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1, max: 100 },
    total: { type: Number, required: true, min: 0 },
    outsideLabId: { type: Schema.Types.ObjectId, ref: "OutsideLab" },
    outsideLabName: { type: String, trim: true },
    sentOutAt: { type: Date },
  },
  { _id: false },
);

const labBillSchema = new Schema<ILabBill>(
  {
    billNumber: { type: String, required: true, unique: true, trim: true },
    billType: { type: String, enum: BILL_TYPES, default: "osp", index: true },
    patientId: { type: Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
    patientType: { type: String, enum: PATIENT_TYPES, default: "osp" },
    visitId: { type: Schema.Types.ObjectId, ref: "Visit" },
    clientId: { type: Schema.Types.ObjectId, ref: "LabClient", index: true },
    clientName: { type: String, trim: true, maxlength: 120 },
    referringDoctorId: { type: Schema.Types.ObjectId, ref: "Doctor", index: true },
    doctorName: { type: String, trim: true, maxlength: 120 },
    items: { type: [billItemSchema], required: true, validate: [(v: IBillItem[]) => v.length > 0, "At least one test is required"] },
    totalAmount: { type: Number, required: true, min: 0 },
    discountPercent: { type: Number, required: true, min: 0, max: 100, default: 0 },
    discountAmount: { type: Number, required: true, min: 0, default: 0 },
    netAmount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, required: true, min: 0, default: 0 },
    dueAmount: { type: Number, required: true, min: 0 },
    paymentMode: { type: String, enum: PAYMENT_MODES, default: "cash" },
    comments: { type: String, trim: true, maxlength: 500 },
    displayComments: { type: String, trim: true, maxlength: 500 },
    status: { type: String, enum: BILL_STATUSES, default: "draft", index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    cancelledAt: { type: Date },
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User" },
    cancellationRemarks: { type: String, trim: true, maxlength: 500 },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform(_doc: unknown, ret: Record<string, unknown>) {
        ret.id = String(ret._id);
        delete ret._id;
        return ret;
      },
    },
  },
);

labBillSchema.virtual("payments", {
  ref: "LabBillPayment",
  localField: "_id",
  foreignField: "billId",
});

labBillSchema.index({ createdAt: -1 });
labBillSchema.index({ "items.departmentId": 1 });
labBillSchema.index({ status: 1, patientType: 1, createdAt: -1 });
// Due collection lists generated bills that still carry a balance, newest first.
labBillSchema.index({ status: 1, dueAmount: -1, createdAt: -1 });

export const LabBill = model<ILabBill>("LabBill", labBillSchema);