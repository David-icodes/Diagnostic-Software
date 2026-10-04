import { model, Schema, type HydratedDocument, type Types } from "mongoose";
import { PACKAGE_TYPES, type PackageType } from "../constants/master-data";

export interface IPackageItem {
  testId: Types.ObjectId;
  departmentId: Types.ObjectId;
}

export interface ILabPackage {
  name: string;
  packageType: PackageType;
  amount: number;
  insAmount?: number;
  active: boolean;
  items: IPackageItem[];
  seedKey?: string;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const packageItemSchema = new Schema<IPackageItem>(
  {
    testId: { type: Schema.Types.ObjectId, ref: "LabTest", required: true },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true },
  },
  { _id: false },
);

const labPackageSchema = new Schema<ILabPackage>(
  {
    name: { type: String, required: true, trim: true, maxlength: 150, index: true },
    packageType: { type: String, enum: PACKAGE_TYPES, required: true, default: "Lab" },
    amount: { type: Number, required: true, min: 0 },
    insAmount: { type: Number, min: 0 },
    active: { type: Boolean, default: true },
    items: { type: [packageItemSchema], default: [] },
    seedKey: { type: String, trim: true, sparse: true, unique: true, maxlength: 80 },
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

labPackageSchema.index({ active: 1, name: 1 });

export type LabPackageDoc = HydratedDocument<ILabPackage>;

export const LabPackage = model<ILabPackage>("LabPackage", labPackageSchema);