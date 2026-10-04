import { model, Schema } from "mongoose";

export interface ILabTechnician {
  name: string;
  designation: string;
  qualification: string;
  mobile?: string;
  signatureNote?: string;
  active: boolean;
  createdBy?: Schema.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const labTechnicianSchema = new Schema<ILabTechnician>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    designation: { type: String, required: true, trim: true, maxlength: 120 },
    qualification: { type: String, trim: true, maxlength: 120 },
    mobile: { type: String, trim: true, maxlength: 20 },
    signatureNote: { type: String, trim: true, maxlength: 120 },
    active: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
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

labTechnicianSchema.index({ active: 1, name: 1 });

export const LabTechnician = model<ILabTechnician>(
  "LabTechnician",
  labTechnicianSchema,
);