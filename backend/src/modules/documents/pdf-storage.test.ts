import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, PageSizes } from "pdf-lib";
import { Writable } from "node:stream";
import type { StoredPdfAsset } from "../../models/pdf-asset.model";
process.env.MONGODB_URI = "mongodb://127.0.0.1/storage_tests_no_connection";
process.env.JWT_SECRET = "test-only-storage-validation-secret";
const modules = Promise.all([import("./pdf-storage.service.js"), import("../../config/cloudinary.js"), import("./pdf-integrity.js")]);
const scope = { owner: "owner", patientId: "patient", billId: "bill", kind: "report" as const };
async function fixture(landscape = false) {
  const document = await PDFDocument.create();
  document.addPage(landscape ? [PageSizes.A4[1], PageSizes.A4[0]] : PageSizes.A4).drawText("Synthetic validation document");
  return Buffer.from(await document.save());
}

test("Cloudinary is optional only when all settings are absent; partial settings fail without revealing values", async () => {
  const [, { cloudinarySettings }] = await modules;
  const empty = { CLOUDINARY_CLOUD_NAME: "", CLOUDINARY_API_KEY: "", CLOUDINARY_API_SECRET: "" };
  assert.equal(cloudinarySettings(empty), null);
  for (const key of Object.keys(empty)) {
    assert.throws(() => cloudinarySettings({ ...empty, [key]: "private-fixture" }), (error: any) => {
      assert.equal(error.statusCode, 503); assert.doesNotMatch(error.message, /private-fixture/); return true;
    });
  }
  assert.equal(cloudinarySettings({ CLOUDINARY_CLOUD_NAME: "example", CLOUDINARY_API_KEY: "key", CLOUDINARY_API_SECRET: "secret" })?.secure, true);
});

test("PDF integrity rejects incomplete/empty files and verifies every page's A4 orientation", async () => {
  const [, , { validatePdf }] = await modules;
  await validatePdf(await fixture(), "report");
  await validatePdf(await fixture(true), "invoice");
  await assert.rejects(validatePdf(await fixture(), "invoice"), /orientation/);
  await assert.rejects(validatePdf(await fixture(true), "report"), /orientation/);
  for (const bad of [Buffer.alloc(0), Buffer.from("%PDF-1.4\n%%EOF"), (await fixture()).subarray(0, 200)]) {
    await assert.rejects(validatePdf(bad, "report"), /invalid/);
  }
  const mixed = await PDFDocument.create(); mixed.addPage(PageSizes.A4); mixed.addPage([100, 100]);
  await assert.rejects(validatePdf(Buffer.from(await mixed.save()), "report"), /orientation/);
});

test("restricted storage round trips exact bytes, deduplicates, scopes access, and fails closed", async () => {
  const [{ createPdfStorage }] = await modules;
  let cloudName: string | null = null; let uploads = 0; let downloads = 0; let failure = "";
  const records: StoredPdfAsset[] = []; const files = new Map<string, Buffer>();
  const store = createPdfStorage({ cloudName: () => cloudName,
    find: async (filter) => records.find((row) => Object.entries(filter).every(([key, value]) => row[key as keyof StoredPdfAsset] === value)) ?? null,
    save: async (asset) => { records.push(asset); return asset; },
    upload: async (pdf, id) => { uploads++; if (failure === "upload") throw new Error("credential-secret"); files.set(id, pdf); return { assetId: "opaque" }; },
    download: async (id) => { downloads++; if (failure === "download") throw new Error("signed-url-secret"); return files.get(id)!; },
  });
  const pdf = await fixture();
  assert.equal(await store.store(pdf, scope), undefined); assert.equal(uploads, 0);
  cloudName = "test-cloud";
  const [key, duplicate] = await Promise.all([store.store(pdf, scope), store.store(pdf, scope)]);
  assert.equal(key, duplicate); assert.equal(uploads, 1);
  assert.equal(await store.store(pdf, scope), key); assert.equal(uploads, 1);
  assert.match(records[0].publicId, /^diagnostic-lis\/reports\/[a-f0-9]{64}\.pdf$/);
  assert.deepEqual(await store.retrieve(key!, scope), pdf);
  const before = downloads;
  for (const changed of [{ owner: "other" }, { patientId: "other" }, { billId: "other" }, { kind: "invoice" as const }]) {
    await assert.rejects(store.retrieve(key!, { ...scope, ...changed }), /authorized review/);
  }
  assert.equal(downloads, before, "Unauthorized requests must not contact Cloudinary");
  const changedDocument = await PDFDocument.load(pdf); changedDocument.setSubject("different version");
  files.set(records[0].publicId, Buffer.from(await changedDocument.save()));
  await assert.rejects(store.retrieve(key!, scope), /integrity verification/);
  files.set(records[0].publicId, pdf); failure = "download";
  await assert.rejects(store.retrieve(key!, scope), (error: any) => !/signed-url-secret/.test(error.message));
  failure = "upload";
  await assert.rejects(store.store(await fixture(true), { ...scope, kind: "invoice" }), (error: any) => !/credential-secret/.test(error.message));
  failure = "";
  const invoiceKey = await store.store(await fixture(true), { ...scope, kind: "invoice" });
  assert.match(records[1].publicId, /\/invoices\//);
  await store.retrieve(invoiceKey!, { ...scope, kind: "invoice" });
  cloudName = null;
  await assert.rejects(store.retrieve(key!, scope), /unavailable/);
});

test("SDK adapter uploads authenticated raw assets and retrieves through expiring server-side HTTPS access", async (t) => {
  const [{ pdfStorage }] = await modules;
  const { env } = await import("../../config/env.js");
  const { v2: sdk } = await import("cloudinary");
  const { PdfAsset } = await import("../../models/pdf-asset.model.js");
  const previous = { CLOUDINARY_CLOUD_NAME: env.CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY: env.CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET: env.CLOUDINARY_API_SECRET };
  Object.assign(env, { CLOUDINARY_CLOUD_NAME: "test-cloud", CLOUDINARY_API_KEY: "test-key", CLOUDINARY_API_SECRET: "test-secret" });
  t.after(() => Object.assign(env, previous));
  const pdf = await fixture(); let metadata: StoredPdfAsset | null = null; let received = Buffer.alloc(0);
  const query = (value: unknown) => ({ lean: () => ({ exec: async () => value }) });
  t.mock.method(PdfAsset, "findOne", (filter: Partial<StoredPdfAsset>) => query(metadata &&
    Object.entries(filter).every(([key, value]) => metadata![key as keyof StoredPdfAsset] === value) ? metadata : null));
  t.mock.method(PdfAsset, "findOneAndUpdate", (_filter: unknown, update: { $setOnInsert: StoredPdfAsset }) => {
    metadata = update.$setOnInsert; return query(metadata);
  });
  t.mock.method(sdk.uploader, "upload_stream", (options: any, callback: any) => {
    assert.equal(options.type, "authenticated"); assert.equal(options.resource_type, "raw");
    assert.equal(options.overwrite, false); assert.equal(options.timeout, 30000);
    return new Writable({ write(chunk, _encoding, next) { received = Buffer.concat([received, chunk]); next(); },
      final(next) { callback(null, { asset_id: "asset-fixture", public_id: options.public_id, resource_type: "raw", type: "authenticated" }); next(); } });
  });
  t.mock.method(sdk.utils, "private_download_url", (id: string, format: string, options: any) => {
    assert.equal(format, ""); assert.equal(id, metadata?.publicId);
    assert.equal(options.type, "authenticated"); assert.equal(options.resource_type, "raw");
    assert.ok(options.expires_at >= Math.floor(Date.now() / 1000) + 58 && options.expires_at <= Math.floor(Date.now() / 1000) + 60);
    return "https://api.cloudinary.com/v1_1/test-cloud/raw/download?signature=test-only";
  });
  t.mock.method(globalThis, "fetch", async (_url: string, options: RequestInit) => {
    assert.equal(options.redirect, "error"); assert.ok(options.signal);
    return new Response(new Uint8Array(pdf));
  });
  const key = await pdfStorage.store(pdf, scope);
  assert.deepEqual(received, pdf); assert.deepEqual(await pdfStorage.retrieve(key!, scope), pdf);
  for (const status of [401, 403, 500]) {
    t.mock.method(globalThis, "fetch", async () => new Response("private provider response", { status }));
    await assert.rejects(pdfStorage.retrieve(key!, scope), (error: any) => error.statusCode === 502 && !/private provider/.test(error.message));
  }
  t.mock.method(globalThis, "fetch", async () => { throw new Error("network credentials signed-url"); });
  await assert.rejects(pdfStorage.retrieve(key!, scope), /integrity verification/);
  t.mock.method(sdk.utils, "private_download_url", () => "https://untrusted.example/file");
  await assert.rejects(pdfStorage.retrieve(key!, scope), /integrity verification/);
  t.mock.method(sdk.uploader, "upload_stream", (_options: any, callback: any) => {
    return new Writable({ write(_chunk, _encoding, next) { next(); }, final(next) {
      callback({ http_code: 401, message: "invalid-credential-do-not-display" }); next();
    } });
  });
  const errors = await Promise.allSettled([pdfStorage.store(pdf, { ...scope, billId: "different" }), pdfStorage.store(pdf, { ...scope, billId: "different" })]);
  for (const result of errors) {
    assert.equal(result.status, "rejected");
    if (result.status === "rejected") { assert.equal(result.reason.statusCode, 502); assert.doesNotMatch(result.reason.message, /invalid-credential/); }
  }
});
