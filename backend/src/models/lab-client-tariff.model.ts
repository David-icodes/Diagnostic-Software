import { model, Schema, type Types } from "mongoose";

/**
 * Client-wise lab tariff. A client+test row holds the price charged to that
 * client for one lab test. History is never affected: bills snapshot their own
 * unit prices at creation time, so changing these rows only affects future
 * billings, never already generated bills.
 */
export interface ILabClientTariff {
  clientId: Types.ObjectId;
  departmentId: Types.ObjectId;
  testId: Types.ObjectId;
  price: number;
  active: boolean;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const labClientTariffSchema = new Schema<ILabClientTariff>(
  {
    clientId: {
      type: Schema.Types.ObjectId,
      ref: "LabClient",
      required: true,
      index: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      required: true,
      index: true,
    },
    testId: {
      type: Schema.Types.ObjectId,
      ref: "LabTest",
      required: true,
    },
    price: { type: Number, required: true, min: 0 },
    active: { type: Boolean, default: true, index: true },
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

labClientTariffSchema.index({ clientId: 1, testId: 1 }, { unique: true });
labClientTariffSchema.index({ clientId: 1, departmentId: 1, active: 1 });

export const LabClientTariff = model<ILabClientTariff>(
  "LabClientTariff",
  labClientTariffSchema,
);