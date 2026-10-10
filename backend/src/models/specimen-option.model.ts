import { model, Schema } from "mongoose";
const schema = new Schema({ kind: { type: String, enum: ["sample", "tube"], required: true }, name: { type: String, required: true, trim: true, maxlength: 50 }, normalizedName: { type: String, required: true }, createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true } }, { timestamps: true });
schema.index({ kind: 1, normalizedName: 1 }, { unique: true });
export const SpecimenOption = model("SpecimenOption", schema);
