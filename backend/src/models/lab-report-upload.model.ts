import { model, Schema, type Types } from "mongoose";

interface ILabReportUpload {
  selectedAt?: Date;
  selectedBy?: Types.ObjectId;
  sha256?: string;
  collectionId?: Types.ObjectId;
  billId: Types.ObjectId;
  patientId: Types.ObjectId;
  testId: Types.ObjectId;
  uploadedBy: Types.ObjectId;
  fileName: string;
  size: number;
  content?: Buffer;
  storageKey?: string;
  createdAt: Date;
}

// Separate attachment collection: no changes to bills, samples or clinical results.
const schema = new Schema<ILabReportUpload>({
  selectedAt: {type:Date},
  selectedBy: {type:Schema.Types.ObjectId,ref:"User"},
  sha256: {type:String,match:/^[a-f0-9]{64}$/},
  collectionId: {type:Schema.Types.ObjectId,ref:"SampleCollection"},
  billId: { type: Schema.Types.ObjectId, ref: "LabBill", required: true },
  patientId: { type: Schema.Types.ObjectId, ref: "Patient", required: true },
  testId: { type: Schema.Types.ObjectId, ref: "LabTest", required: true },
  uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  fileName: { type: String, required: true, maxlength: 160 },
  size: { type: Number, required: true },
  content: { type: Buffer, required: function () { return !this.storageKey; }, select: false },
  storageKey: { type: String, match: /^[a-f0-9]{64}$/ },
}, { timestamps: { createdAt: true, updatedAt: false } });
schema.index({ billId: 1, testId: 1, createdAt: -1 });
// Historical rows without a digest remain untouched; new identical uploads are idempotent.
schema.index({billId:1,patientId:1,testId:1,collectionId:1,sha256:1},
  {unique:true,partialFilterExpression:{sha256:{$type:"string"}}});
export const LabReportUpload = model<ILabReportUpload>("LabReportUpload", schema);
