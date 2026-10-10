import { model, Schema, type Types } from "mongoose";

export const COMMISSION_SCOPES = ["doctor", "department", "test"] as const;
export type CommissionScope = (typeof COMMISSION_SCOPES)[number];

export interface IDoctorCommission {
  scope: CommissionScope;
  doctorId: Types.ObjectId;
  departmentId?: Types.ObjectId;
  testId?: Types.ObjectId;
  /** Percentage (0–100). Precedence: a fixed amount at test scope wins. */
  commissionPercent: number;
  /** Fixed rupee amount per test (test scope only). */
  commissionAmount?: number;
  active: boolean;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const doctorCommissionSchema = new Schema<IDoctorCommission>(
  {
    scope: {
      type: String,
      enum: COMMISSION_SCOPES,
      required: true,
      index: true,
    },
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
      index: true,
    },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department" },
    testId: { type: Schema.Types.ObjectId, ref: "LabTest" },
    commissionPercent: { type: Number, required: true, min: 0, max: 100, default: 0 },
    commissionAmount: { type: Number, min: 0 },
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

doctorCommissionSchema.index({ doctorId: 1, scope: 1, departmentId: 1, testId: 1 }, { unique: true });

export const DoctorCommission = model<IDoctorCommission>(
  "DoctorCommission",
  doctorCommissionSchema,
);