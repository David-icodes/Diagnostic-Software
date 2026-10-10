import { model, Schema, type Types } from "mongoose";

interface ILabReportUpload {
  billId: Types.ObjectId;
  patientId: Types.ObjectId;
  testId: Types.ObjectId;
  uploadedBy: Types.ObjectId;
  fileName: string;
  size: number;
  content: Buffer;
  createdAt: Date;
}

// Separate attachment collection: no changes to bills, samples or clinical results.
const schema = new Schema<ILabReportUpload>({
  billId: { type: Schema.Types.ObjectId, ref: "LabBill", required: true },
  patientId: { type: Schema.Types.ObjectId, ref: "Patient", required: true },
  testId: { type: Schema.Types.ObjectId, ref: "LabTest", required: true },
  uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  fileName: { type: String, required: true, maxlength: 160 },
  size: { type: Number, required: true },
  content: { type: Buffer, required: true, select: false },
}, { timestamps: { createdAt: true, updatedAt: false } });
schema.index({ billId: 1, testId: 1, createdAt: -1 });
export const LabReportUpload = model<ILabReportUpload>("LabReportUpload", schema);
