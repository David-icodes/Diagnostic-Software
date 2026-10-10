import { Schema, model, type HydratedDocument } from "mongoose";

export const GENDERS = ["male", "female", "other"] as const;
export const BLOOD_GROUPS = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
  "Unknown",
] as const;

export type PatientGender = (typeof GENDERS)[number];
export type PatientBloodGroup = (typeof BLOOD_GROUPS)[number];
export type PatientStatus = "active" | "inactive";

export interface IPatient {
  patientId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  gender: PatientGender;
  dateOfBirth?: Date;
  age?: number;
  mobile: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  emergencyContact?: string;
  bloodGroup?: PatientBloodGroup;
  createdBy: Schema.Types.ObjectId;
  updatedBy?: Schema.Types.ObjectId;
  status: PatientStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

const patientSchema = new Schema<IPatient>(
  {
    patientId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      trim: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
    lastName: {
      type: String,
      trim: true,
      maxlength: 60,
      default: "",
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 121,
    },
    gender: {
      type: String,
      enum: GENDERS,
      required: true,
    },
    dateOfBirth: { type: Date },
    age: { type: Number, min: 0, max: 150 },
    mobile: {
      type: String,
      required: true,
      trim: true,
    },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true, maxlength: 500 },
    city: { type: String, trim: true, maxlength: 100 },
    state: { type: String, trim: true, maxlength: 100 },
    pincode: { type: String, trim: true },
    emergencyContact: { type: String, trim: true },
    bloodGroup: { type: String, enum: BLOOD_GROUPS },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
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

// Indexes for the most common list/search paths.
patientSchema.index({ fullName: 1 });
patientSchema.index({ mobile: 1 });
patientSchema.index({ email: 1 });
patientSchema.index({ createdAt: -1 });
// The OSP registration report lists active registrations in registration order.
patientSchema.index({ status: 1, createdAt: 1 });
patientSchema.index({ createdBy: 1 });

patientSchema.pre("validate", function computeFullName(next) {
  this.fullName = [this.firstName, this.lastName]
    .filter((part) => part && part.trim())
    .join(" ")
    .trim();
  return next();
});

export type PatientDoc = HydratedDocument<IPatient>;

export const Patient = model<IPatient>("Patient", patientSchema);