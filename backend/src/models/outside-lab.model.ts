import { model, Schema, type Types } from "mongoose";

export interface IOutsideLab {
  code: string;
  name: string;
  address?: string;
  city?: string;
  phone?: string;
  active: boolean;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const outsideLabSchema = new Schema<IOutsideLab>(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, unique: true, trim: true, maxlength: 120 },
    address: { type: String, trim: true, maxlength: 200 },
    city: { type: String, trim: true, maxlength: 80 },
    phone: { type: String, trim: true, maxlength: 30 },
    active: { type: Boolean, default: true, index: true },
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

outsideLabSchema.index({ active: 1, name: 1 });

export const OutsideLab = model<IOutsideLab>("OutsideLab", outsideLabSchema);