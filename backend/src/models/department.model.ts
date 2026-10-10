import { model, Schema, type HydratedDocument } from "mongoose";
import { DEPARTMENT_TYPES, type DepartmentType } from "../constants/master-data";

export interface IDepartment {
  name: string;
  code: string;
  description?: string;
  type?: DepartmentType;
  active: boolean;
  sortOrder: number;
  createdBy: Schema.Types.ObjectId;
  updatedBy?: Schema.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const departmentSchema = new Schema<IDepartment>(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
    code: { type: String, required: true, unique: true, trim: true, uppercase: true, maxlength: 10 },
    description: { type: String, trim: true, maxlength: 500 },
    type: { type: String, enum: DEPARTMENT_TYPES, default: "Lab & X-Ray" },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0, min: 0 },
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

departmentSchema.index({ sortOrder: 1, name: 1 });
departmentSchema.index({ active: 1 });

export type DepartmentDoc = HydratedDocument<IDepartment>;

export const Department = model<IDepartment>("Department", departmentSchema);