import { model, Schema, type Types } from "mongoose";

export type ResultValue = string | number | boolean;

export interface IResultRevision {
  result: ResultValue;
  enteredBy: Types.ObjectId;
  enteredAt: Date;
  version: number;
}

/**
 * The reference range that actually applied when this result was recorded.
 *
 * Stored so a report reprinted months later shows the range in force at the
 * time of entry, even if the master parameter has since been remapped. Older
 * results have no snapshot and keep relying on `referenceRange`.
 */
export interface IReferenceSnapshot {
  status: string;
  source: "MAPPING" | "LEGACY" | "NONE";
  mappingType?: string;
  mappingId?: string;
  valueType?: string;
  displayValue?: string;
  valueFrom?: number;
  valueTo?: number;
  sex?: string;
  ageUnit?: string;
  ageFrom?: number;
  ageTo?: number;
  /** Patient context the decision was based on. */
  patientAgeYears?: number;
  patientSex?: string;
  /** Whether the entered value was inside the stored bounds. */
  flag?: "IN_RANGE" | "OUT_OF_RANGE" | "NOT_COMPARABLE";
  reason?: string;
  capturedAt: Date;
}

export interface ILabTestResult {
  billId: Types.ObjectId;
  patientId: Types.ObjectId;
  testId: Types.ObjectId;
  parameterId: Types.ObjectId;
  parameterName: string;
  resultType: string;
  unit?: string;
  referenceRange?: string;
  /** Structured snapshot of the reference range applied at entry time. */
  referenceSnapshot?: IReferenceSnapshot;
  method?: string;
  result: ResultValue;
  enteredBy: Types.ObjectId;
  enteredAt: Date;
  version: number;
  revisions: IResultRevision[];
  createdAt?: Date;
  updatedAt?: Date;
}

const referenceSnapshotSchema = new Schema<IReferenceSnapshot>(
  {
    status: { type: String, required: true, maxlength: 40 },
    source: { type: String, enum: ["MAPPING", "LEGACY", "NONE"], required: true },
    mappingType: { type: String, maxlength: 30 },
    // Identifies a mapping inside this result's parameter's embedded array, so it
    // is stored as the subdocument's id rather than a collection reference.
    mappingId: { type: String, maxlength: 40 },
    valueType: { type: String, maxlength: 20 },
    displayValue: { type: String, trim: true, maxlength: 200 },
    valueFrom: { type: Number },
    valueTo: { type: Number },
    sex: { type: String, maxlength: 10 },
    ageUnit: { type: String, maxlength: 10 },
    ageFrom: { type: Number },
    ageTo: { type: Number },
    patientAgeYears: { type: Number },
    patientSex: { type: String, maxlength: 20 },
    flag: { type: String, enum: ["IN_RANGE", "OUT_OF_RANGE", "NOT_COMPARABLE"] },
    reason: { type: String, trim: true, maxlength: 400 },
    capturedAt: { type: Date, required: true },
  },
  { _id: false },
);

const resultRevisionSchema = new Schema<IResultRevision>(
  {
    result: { type: Schema.Types.Mixed, required: true },
    enteredBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    enteredAt: { type: Date, required: true },
    version: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const labTestResultSchema = new Schema<ILabTestResult>(
  {
    billId: { type: Schema.Types.ObjectId, ref: "LabBill", required: true, index: true },
    patientId: { type: Schema.Types.ObjectId, ref: "Patient", required: true, index: true },
    testId: { type: Schema.Types.ObjectId, ref: "LabTest", required: true },
    parameterId: { type: Schema.Types.ObjectId, ref: "LabTestParameter", required: true },
    parameterName: { type: String, required: true, trim: true, maxlength: 150 },
    resultType: { type: String, required: true, maxlength: 20 },
    unit: { type: String, trim: true, maxlength: 50 },
    // Snapshot of the master parameter's display range. Kept at 200 (same as
    // LabTestParameter.referenceRange) so long, multi-line reference texts
    // never break on save.
    referenceRange: { type: String, trim: true, maxlength: 200 },
    referenceSnapshot: { type: referenceSnapshotSchema },
    method: { type: String, trim: true, maxlength: 120 },
    result: { type: Schema.Types.Mixed, required: true },
    enteredBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    enteredAt: { type: Date, required: true },
    version: { type: Number, required: true, min: 1, default: 1 },
    revisions: { type: [resultRevisionSchema], default: [] },
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

labTestResultSchema.index(
  { billId: 1, testId: 1, parameterId: 1 },
  { unique: true },
);
labTestResultSchema.index({ enteredAt: -1 });

export const LabTestResult = model<ILabTestResult>("LabTestResult", labTestResultSchema);