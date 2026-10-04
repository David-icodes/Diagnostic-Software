import { model, Schema, type HydratedDocument } from "mongoose";

export interface IDoctorSpecialisation {
  name: string;
  active: boolean;
  createdBy?: Schema.Types.ObjectId;
  updatedBy?: Schema.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const doctorSpecialisationSchema = new Schema<IDoctorSpecialisation>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    active: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
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

doctorSpecialisationSchema.index(
  { name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } },
);

export type DoctorSpecialisationDoc = HydratedDocument<IDoctorSpecialisation>;

export const DoctorSpecialisation = model<IDoctorSpecialisation>(
  "DoctorSpecialisation",
  doctorSpecialisationSchema,
);