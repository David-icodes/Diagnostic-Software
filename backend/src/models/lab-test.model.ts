import { model, Schema, type Types } from "mongoose";

export type LabTestResultMode =
  | "PARAMETER_BASED"
  | "TEMPLATE_BASED"
  | "SIMPLE_RESULT"
  | "CALCULATED";

export interface ILabTest {
  testCode: string;
  testName: string;
  shortName: string;
  departmentId: Types.ObjectId;
  description?: string;
  sampleType?: string;
  containerType?: string;
  testType?: string;
  /** Out-patient price — the default tariff used for OP/OSP/corporate bills. */
  price: number;
  /** In-patient price, falls back to `price` when not configured. */
  priceIp?: number;
  /** Insured in-patient price, falls back to `priceIp` when not configured. */
  priceInsIp?: number;
  /** Emergency price, falls back to `price` when not configured. */
  priceEr?: number;
  /** Doctor/referral price, falls back to `price` when not configured. */
  doctorPrice?: number;
  cghsCode?: string;
  nimsCode?: string;
  railwayCode?: string;
  nfcCode?: string;
  comments?: string;
  /** Referral commission percentage (0–100) used when no mapping exists. */
  referralPercent?: number;
  reportNote1?: string;
  reportNote2?: string;
  active: boolean;
  resultMode: LabTestResultMode;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export const LAB_TEST_RESULT_MODES: LabTestResultMode[] = [
  "PARAMETER_BASED",
  "TEMPLATE_BASED",
  "SIMPLE_RESULT",
  "CALCULATED",
];

const labTestSchema = new Schema<ILabTest>(
  {
    testCode: { type: String, required: true, unique: true, trim: true, uppercase: true, maxlength: 20 },
    testName: { type: String, required: true, unique: true, trim: true, maxlength: 150 },
    shortName: { type: String, required: true, trim: true, maxlength: 50 },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true, index: true },
    description: { type: String, trim: true, maxlength: 1000 },
    sampleType: { type: String, trim: true, maxlength: 50 },
    containerType: { type: String, trim: true, maxlength: 50 },
    testType: { type: String, trim: true, maxlength: 50 },
    price: { type: Number, required: true, min: 0 },
    priceIp: { type: Number, min: 0 },
    priceInsIp: { type: Number, min: 0 },
    priceEr: { type: Number, min: 0 },
    doctorPrice: { type: Number, min: 0 },
    cghsCode: { type: String, trim: true, maxlength: 30 },
    nimsCode: { type: String, trim: true, maxlength: 30 },
    railwayCode: { type: String, trim: true, maxlength: 30 },
    nfcCode: { type: String, trim: true, maxlength: 30 },
    comments: { type: String, trim: true, maxlength: 1000 },
    referralPercent: { type: Number, min: 0, max: 100 },
    reportNote1: { type: String, trim: true, maxlength: 500 },
    reportNote2: { type: String, trim: true, maxlength: 500 },
    active: { type: Boolean, default: true },
    resultMode: { type: String, enum: LAB_TEST_RESULT_MODES, default: "SIMPLE_RESULT" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
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

labTestSchema.index({ departmentId: 1, active: 1 });
labTestSchema.index({ active: 1, testName: 1 });

export const LabTest = model<ILabTest>("LabTest", labTestSchema);