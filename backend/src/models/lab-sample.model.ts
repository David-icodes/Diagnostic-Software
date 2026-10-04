import { model, Schema, type Types } from "mongoose";

export const SAMPLE_STATUS_OPTIONS = [
  "SELECT",
  "COLLECTED",
  "RECEIVED",
  "PROCESSED",
  "RECOLLECTED",
  "REJECTED",
] as const;

export type SampleStatus = (typeof SAMPLE_STATUS_OPTIONS)[number];

export const SAMPLE_STATUSES: SampleStatus[] = [...SAMPLE_STATUS_OPTIONS];

export interface ISampleHistoryEntry {
  status: SampleStatus;
  changedAt: Date;
  changedBy: Types.ObjectId;
  comments?: string;
}

export interface ILabSample {
  sampleId: string;
  billId: Types.ObjectId;
  patientId: Types.ObjectId;
  testId: Types.ObjectId;
  departmentId?: Types.ObjectId;
  sampleType?: string;
  containerType?: string;
  sampleStatus: SampleStatus;
  collectedAt?: Date;
  receivedAt?: Date;
  processedAt?: Date;
  recollectedAt?: Date;
  rejectedAt?: Date;
  outsideLabId?: Types.ObjectId;
  sentOutAt?: Date;
  comments?: string;
  history: ISampleHistoryEntry[];
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const sampleHistorySchema = new Schema<ISampleHistoryEntry>(
  {
    status: { type: String, enum: SAMPLE_STATUSES, required: true },
    changedAt: { type: Date, required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    comments: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false },
);

const labSampleSchema = new Schema<ILabSample>(
  {
    sampleId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    billId: { type: Schema.Types.ObjectId, ref: "LabBill", required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
    testId: { type: Schema.Types.ObjectId, ref: "LabTest", required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department" },
    sampleType: { type: String, trim: true, maxlength: 50 },
    containerType: { type: String, trim: true, maxlength: 50 },
    sampleStatus: {
      type: String,
      enum: SAMPLE_STATUSES,
      default: "SELECT",
      index: true,
    },
    collectedAt: { type: Date },
    receivedAt: { type: Date },
    processedAt: { type: Date },
    recollectedAt: { type: Date },
    rejectedAt: { type: Date },
    outsideLabId: { type: Schema.Types.ObjectId, ref: "OutsideLab" },
    sentOutAt: { type: Date },
    comments: { type: String, trim: true, maxlength: 500 },
    history: { type: [sampleHistorySchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
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

labSampleSchema.index({ billId: 1, testId: 1 }, { unique: true });
labSampleSchema.index({ sampleStatus: 1, createdAt: -1 });
labSampleSchema.index({ outsideLabId: 1, sentOutAt: -1 });

export const LabSample = model<ILabSample>("LabSample", labSampleSchema);