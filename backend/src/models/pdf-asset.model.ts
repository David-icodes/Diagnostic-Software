import { model, Schema } from "mongoose";
import type { PdfKind } from "../modules/documents/pdf-integrity";

export interface StoredPdfAsset {
  key: string; owner: string; patientId: string; billId: string; kind: PdfKind;
  cloudName: string; publicId: string; assetId: string; sha256: string; bytes: number;
}
const schema = new Schema<StoredPdfAsset>({
  key: { type: String, required: true, unique: true },
  owner: { type: String, required: true }, patientId: { type: String, required: true },
  billId: { type: String, required: true }, kind: { type: String, enum: ["report", "invoice"], required: true },
  cloudName: { type: String, required: true }, publicId: { type: String, required: true },
  assetId: { type: String, required: true }, sha256: { type: String, required: true },
  bytes: { type: Number, required: true },
}, { timestamps: true });
// Additive metadata only; no changes to patients, bills, or existing records. No TTL cleanup.
export const PdfAsset = model<StoredPdfAsset>("PdfAsset", schema);
