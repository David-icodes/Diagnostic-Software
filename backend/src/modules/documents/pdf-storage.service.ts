import { createHash } from "node:crypto";
import { configuredCloudinary } from "../../config/cloudinary";
import { PdfAsset, type StoredPdfAsset } from "../../models/pdf-asset.model";
import { ApiError } from "../../utils/api-error";
import { MAX_PDF_BYTES, validatePdf, type PdfKind } from "./pdf-integrity";

export interface PdfScope { owner: string; patientId: string; billId: string; kind: PdfKind }
interface StorageDependencies {
  cloudName(): string | null;
  find(filter: Partial<StoredPdfAsset>): Promise<StoredPdfAsset | null>;
  save(asset: StoredPdfAsset): Promise<StoredPdfAsset>;
  upload(pdf: Buffer, publicId: string): Promise<{ assetId: string }>;
  download(publicId: string): Promise<Buffer>;
}
const hash = (data: Buffer | string) => createHash("sha256").update(data).digest("hex");

/** Call only after route authentication/permission and canonical patient/bill validation. */
export function createPdfStorage(deps: StorageDependencies) {
  const pending = new Map<string, Promise<string>>();
  return {
    async store(pdf: Buffer, scope: PdfScope): Promise<string | undefined> {
      const cloudName = deps.cloudName(); // Missing ALL settings is optional; partial settings fail closed.
      if (!cloudName) return undefined;
      await validatePdf(pdf, scope.kind);
      const sha256 = hash(pdf);
      const key = hash(JSON.stringify([cloudName, scope.owner, scope.patientId, scope.billId, scope.kind, sha256]));
      if (pending.has(key)) return pending.get(key)!;
      const operation = (async () => {
        const existing = await deps.find({ key, ...scope, cloudName });
        if (existing) return key;
        // Opaque identifier: no patient name, bill number, or clinical content in Cloudinary metadata.
        const publicId = `diagnostic-lis/${scope.kind === "report" ? "reports" : "invoices"}/${key}.pdf`;
        const uploaded = await deps.upload(pdf, publicId);
        if (!uploaded.assetId) throw new Error();
        await deps.save({ key, ...scope, cloudName, publicId, assetId: uploaded.assetId, sha256, bytes: pdf.length });
        return key;
      })().catch(() => { throw new ApiError(502, "Restricted PDF storage failed. No message was sent."); });
      pending.set(key, operation);
      try { return await operation; }
      catch { throw new ApiError(502, "Restricted PDF storage failed. No message was sent."); }
      finally { pending.delete(key); }
    },
    async retrieve(key: string, scope: PdfScope): Promise<Buffer> {
      const cloudName = deps.cloudName();
      if (!cloudName) throw new ApiError(503, "Restricted PDF storage is unavailable. No message was sent.");
      let asset: StoredPdfAsset | null;
      try { asset = await deps.find({ key, ...scope, cloudName }); }
      catch { throw new ApiError(502, "PDF storage metadata could not be loaded. No message was sent."); }
      if (!asset) throw new ApiError(403, "The stored PDF is unavailable for this authorized review");
      const expectedId = `diagnostic-lis/${scope.kind === "report" ? "reports" : "invoices"}/${key}.pdf`;
      if (!/^[a-f0-9]{64}$/.test(key) || asset.publicId !== expectedId) throw new ApiError(403, "Stored PDF association is invalid");
      try {
        const pdf = await deps.download(asset.publicId);
        await validatePdf(pdf, scope.kind);
        if (pdf.length !== asset.bytes || hash(pdf) !== asset.sha256) throw new Error();
        return pdf;
      } catch { throw new ApiError(502, "Restricted PDF retrieval or integrity verification failed. No message was sent."); }
    },
  };
}

export const pdfStorage = createPdfStorage({
  cloudName: () => configuredCloudinary()?.cloudName ?? null,
  find: (filter) => PdfAsset.findOne(filter).lean().exec(),
  save: async (asset) => {
    try {
      return (await PdfAsset.findOneAndUpdate({ key: asset.key }, { $setOnInsert: asset },
        { upsert: true, new: true, runValidators: true }).lean().exec())!;
    } catch (error) {
      // Concurrent identical uploads may race on the unique key. Never overwrite an asset.
      if ((error as { code?: number }).code === 11000) {
        const existing = await PdfAsset.findOne({ key: asset.key }).lean().exec();
        if (existing) return existing;
      }
      throw error;
    }
  },
  upload: (pdf, publicId) => new Promise((resolve, reject) => {
    const configured = configuredCloudinary();
    if (!configured) { reject(new Error()); return; }
    const stream = configured.client.uploader.upload_stream({ public_id: publicId,
      resource_type: "raw", type: "authenticated", overwrite: false, unique_filename: false,
      timeout: 30000 }, (error, result) => {
      if (error || !result?.asset_id || result.public_id !== publicId || result.resource_type !== "raw" || result.type !== "authenticated") {
        reject(new Error()); return;
      }
      resolve({ assetId: result.asset_id });
    });
    stream.on("error", () => reject(new Error()));
    stream.end(pdf);
  }),
  download: async (publicId) => {
    const configured = configuredCloudinary();
    if (!configured) throw new Error();
    // Signed access stays server-side, expires in 60 seconds, and is never logged or returned.
    const url = configured.client.utils.private_download_url(publicId, "", {
      resource_type: "raw", type: "authenticated", expires_at: Math.floor(Date.now() / 1000) + 60,
      attachment: true });
    const target = new URL(url);
    if (target.protocol !== "https:" || target.hostname !== "api.cloudinary.com") throw new Error();
    const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(30000) });
    if (!response.ok || !response.body) throw new Error();
    const reader = response.body.getReader();
    const chunks: Buffer[] = [];
    let length = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        length += chunk.value.length;
        if (length > MAX_PDF_BYTES) throw new Error();
        chunks.push(Buffer.from(chunk.value));
      }
    } finally { await reader.cancel().catch(() => {}); }
    return Buffer.concat(chunks);
  },
});
