import { model, Schema, type HydratedDocument, type Types } from "mongoose";
import { DOCTOR_TYPES, type DoctorType } from "../constants/master-data";

export interface IDoctor {
  name: string;
  employeeId?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  shortName?: string;
  gender?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  city?: string;
  specialisationId?: Types.ObjectId;
  specialization?: string;
  designationId?: Types.ObjectId;
  designation?: string;
  doctorType?: DoctorType;
  departmentId?: Types.ObjectId;
  onlineAppDisplay?: "Y" | "N";
  address?: string;
  roomNumber?: string;
  qualification?: string;
  opConsultationFee?: number;
  ipConsultationFee?: number;
  hospitalFee?: number;
  erConsultationFee?: number;
  maxFreeVisits?: number;
  maxFreeDaysVisits?: number;
  active: boolean;
  createdBy?: Schema.Types.ObjectId;
  updatedBy?: Schema.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const doctorSchema = new Schema<IDoctor>(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 200 },
    employeeId: { type: String, trim: true, maxlength: 50 },
    firstName: { type: String, trim: true, maxlength: 100 },
    lastName: { type: String, trim: true, maxlength: 100 },
    middleName: { type: String, trim: true, maxlength: 100 },
    shortName: { type: String, trim: true, maxlength: 60 },
    gender: { type: String, trim: true, enum: ["Male", "Female", "Other"] },
    email: { type: String, trim: true, lowercase: true, maxlength: 160 },
    phone: { type: String, trim: true, maxlength: 20 },
    mobile: { type: String, trim: true, match: /^[6-9]\d{9}$/ },
    city: { type: String, trim: true, maxlength: 120 },
    specialisationId: { type: Schema.Types.ObjectId, ref: "DoctorSpecialisation" },
    specialization: { type: String, trim: true, maxlength: 100 },
    designationId: { type: Schema.Types.ObjectId, ref: "DoctorDesignation" },
    designation: { type: String, trim: true, maxlength: 100 },
    doctorType: { type: String, enum: DOCTOR_TYPES },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department" },
    onlineAppDisplay: { type: String, enum: ["Y", "N"], default: "Y" },
    address: { type: String, trim: true, maxlength: 500 },
    roomNumber: { type: String, trim: true, maxlength: 40 },
    qualification: { type: String, trim: true, maxlength: 100 },
    opConsultationFee: { type: Number, min: 0 },
    ipConsultationFee: { type: Number, min: 0 },
    hospitalFee: { type: Number, min: 0 },
    erConsultationFee: { type: Number, min: 0 },
    maxFreeVisits: { type: Number, min: 0, default: 0 },
    maxFreeDaysVisits: { type: Number, min: 0, default: 0 },
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

doctorSchema.index({ active: 1, name: 1 });
doctorSchema.index({ departmentId: 1 });
doctorSchema.index({ specialisationId: 1 });
doctorSchema.index({ designationId: 1 });

export type DoctorDoc = HydratedDocument<IDoctor>;

export const Doctor = model<IDoctor>("Doctor", doctorSchema);