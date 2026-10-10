import { model, Schema, type HydratedDocument } from "mongoose";

export interface ILabClient {
  clientCode: string;
  name: string;
  contactPerson?: string;
  mobile?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  active: boolean;
  createdBy: Schema.Types.ObjectId;
  updatedBy?: Schema.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const labClientSchema = new Schema<ILabClient>(
  {
    clientCode: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
    },
    name: { type: String, required: true, unique: true, trim: true, maxlength: 120 },
    contactPerson: { type: String, trim: true, maxlength: 120 },
    mobile: { type: String, trim: true, match: /^[6-9]\d{9}$/ },
    phone: { type: String, trim: true, maxlength: 20 },
    email: { type: String, trim: true, lowercase: true, maxlength: 120 },
    address: { type: String, trim: true, maxlength: 500 },
    city: { type: String, trim: true, maxlength: 100 },
    active: { type: Boolean, default: true },
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

labClientSchema.index({ active: 1, name: 1 });
labClientSchema.index({ createdAt: -1 });

export type LabClientDoc = HydratedDocument<ILabClient>;

export const LabClient = model<ILabClient>("LabClient", labClientSchema);