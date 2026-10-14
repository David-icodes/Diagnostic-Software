import { model, Schema } from "mongoose";

// Additive collection history; existing sample/result identifiers remain valid.
const schema = new Schema({
  sampleId: { type: Schema.Types.ObjectId, ref: "LabSample", required: true },
  billId: { type: Schema.Types.ObjectId, ref: "LabBill", required: true },
  patientId: { type: Schema.Types.ObjectId, ref: "Patient", required: true },
  testId: { type: Schema.Types.ObjectId, ref: "LabTest", required: true },
  previousCollectionId: { type: Schema.Types.ObjectId, ref: "SampleCollection" },
  reason: { type: String, required: true, maxlength: 500 },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  supersededAt: Date,
  supersededBy: { type: Schema.Types.ObjectId, ref: "User" },
  resultSnapshots: { type: [Schema.Types.Mixed], default: [] },
}, { timestamps: true });
schema.index({ sampleId: 1, createdAt: 1 });
export const SampleCollection = model("SampleCollection", schema);
