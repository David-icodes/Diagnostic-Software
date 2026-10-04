import { model, Schema, type HydratedDocument, type Types } from "mongoose";
import { LOCATION_LEVEL_ORDER, type LocationLevel } from "../constants/master-data";

export interface ILocation {
  type: LocationLevel;
  name: string;
  parentId?: Types.ObjectId | null;
  active: boolean;
  createdBy?: Schema.Types.ObjectId;
  updatedBy?: Schema.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const locationSchema = new Schema<ILocation>(
  {
    type: { type: String, enum: LOCATION_LEVEL_ORDER, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    parentId: { type: Schema.Types.ObjectId, ref: "Location", default: null, index: true },
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

locationSchema.index(
  { type: 1, name: 1 },
  {
    unique: true,
    collation: { locale: "en", strength: 2 },
    partialFilterExpression: { type: "country" },
  },
);

locationSchema.index(
  { type: 1, parentId: 1, name: 1 },
  {
    unique: true,
    collation: { locale: "en", strength: 2 },
    partialFilterExpression: { type: { $in: ["state", "district", "city"] } },
  },
);

export type LocationDoc = HydratedDocument<ILocation>;

export const Location = model<ILocation>("Location", locationSchema);