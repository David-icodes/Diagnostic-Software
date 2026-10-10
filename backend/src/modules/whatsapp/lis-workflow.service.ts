import { createHash, randomUUID } from "node:crypto";
import type { Request } from "express";
import { env } from "../../config/env";
import { ApiError } from "../../utils/api-error";
import { LabBill } from "../../models/lab-bill.model";
import { Patient } from "../../models/patient.model";
import { LabTestResult } from "../../models/lab-test-result.model";
import { LabSample } from "../../models/lab-sample.model";
import { LabTechnician } from "../../models/lab-technician.model";
import { WhatsAppMessage } from "../../models/whatsapp-message.model";
import { getLabBill } from "../lab-bills/lab-bill.service";
import { getBillResultEntry } from "../test-results/test-result.service";
import { assertResultReportAllowed } from "../test-results/result-workflow.service";
import { recordAudit } from "../audit/audit.service";
import { sendWhatsAppTemplateMessage } from "./whatsapp-send.service";
import { normalizeLisRecipient } from "./lis-recipient";
import { LIS_TEMPLATES, languageFor, templateComponents, templateVariables } from "./lis-template";
import { maskedRecipient } from "./lis-delivery.service";
import { uploadLisPdf } from "./lis-media.service";
import { pdfFailure, rendererOrigin } from "./lis-pdf-diagnostics";
import type { ReviewLisMessageInput } from "../../validations/whatsapp-lis";

const json = (value: unknown) => JSON.parse(JSON.stringify(value));
const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const dateLabel = (value: Date) => {
  if (!Number.isFinite(value.getTime())) throw new ApiError(422, "Document date is unavailable");
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(value);
};

async function deploymentCentre(): Promise<string> {
  // Read the same frontend organisation config used by printed reports. This
  // endpoint exposes public branding only; it is not a new database master.
  try {
    const response = await fetch(new URL("/whatsapp/organisation", env.FRONTEND_URL), { signal: AbortSignal.timeout(10000), headers: { "Cache-Control": "no-cache" } });
    const data = await response.json() as { name?: string };
    if (!response.ok || !data.name?.trim()) throw new Error();
    return data.name.trim();
  } catch { throw new ApiError(503, "Existing deployment centre branding could not be loaded"); }
}

export async function loadLisContext(input: ReviewLisMessageInput, printedBy: string) {
  const bill = await LabBill.findById(input.billId).exec();
  if (!bill || String(bill.patientId) !== input.patientId) throw new ApiError(422, "The selected bill does not belong to the selected patient");
  if (bill.status !== "generated") throw new ApiError(422, "Select a generated, non-cancelled bill");
  const patient = await Patient.findById(input.patientId).exec();
  if (!patient) throw new ApiError(404, "Patient not found");
  const mobile = normalizeLisRecipient(patient.mobile ?? "");
  const isReport = input.templateName === "lab_report_ready";
  const testIds = [...new Set(input.testIds)];
  if (isReport) await assertResultReportAllowed(input.billId, testIds, input.workflow !== "lab-reprint");
  const centreName = await deploymentCentre();
  const [populatedBill, entry, results, samples, technician] = await Promise.all([
    getLabBill(input.billId),
    isReport ? getBillResultEntry(input.billId) : null,
    isReport ? LabTestResult.find({ billId: bill._id, patientId: patient._id, testId: { $in: testIds } }).sort({ enteredAt: -1 }).exec() : [],
    isReport ? LabSample.find({ billId: bill._id, testId: { $in: testIds }, sampleStatus: { $in: ["COLLECTED", "RECOLLECTED"] } }).exec() : [],
    isReport && input.technicianId ? LabTechnician.findOne({ _id: input.technicianId, active: true }).exec() : null,
  ]);
  if (isReport && input.technicianId && !technician) throw new ApiError(422, "Selected technician is unavailable");
  const reports = isReport ? entry!.tests.filter((test) => testIds.includes(test.testId)).map((test) => {
    const item = bill.items.find((row) => String(row.testId) === test.testId)!;
    const saved = results.filter((row) => String(row.testId) === test.testId);
    if (!test.testLinked || !saved.length || !test.parameters.length) throw new ApiError(422, "The selected laboratory report is unavailable");
    return {
      item: json(item), results: json(saved),
      parameters: test.parameters.map((parameter) => ({ ...parameter, id: parameter.parameterId, testId: test.testId, active: true, referenceRange: parameter.reference.displayValue })),
      resolvedReferences: Object.fromEntries(test.parameters.map((parameter) => [parameter.parameterId, parameter.reference.displayValue ?? ""])),
      referenceResolutions: Object.fromEntries(test.parameters.map((parameter) => [parameter.parameterId, parameter.reference])),
      collectedOn: samples.find((row) => String(row.testId) === test.testId)?.history.at(-1)?.changedAt,
    };
  }) : [];
  const newest = results.reduce((latest, row) => Math.max(latest, new Date(row.enteredAt).getTime()), 0);
  const variables = templateVariables(input.templateName, {
    patientName: patient.fullName, centreName, patientCode: patient.patientId, billNumber: bill.billNumber,
    billDate: dateLabel(bill.createdAt!), reportDate: isReport ? dateLabel(new Date(newest)) : undefined,
    net: bill.netAmount, paid: bill.paidAmount, balance: bill.dueAmount,
  });
  return json({
    patientName: patient.fullName, patientCode: patient.patientId, mobile, centreName,
    billNumber: bill.billNumber, billDate: dateLabel(bill.createdAt!), variables,
    document: { bill: populatedBill, reports, technician, printedBy, onlyEntered: input.onlyEntered, printMode: input.printMode },
  });
}

type Review = {
  owner: string; input: ReviewLisMessageInput; printedBy: string; expires: number;
  context: Awaited<ReturnType<typeof loadLisContext>>; digest: string;
  pdf?: Buffer; filename?: string; state: "review" | "sending" | "sent" | "failed";
  result?: { metaMessageId: string; waId?: string }; rendering: boolean;
};
const reviews = new Map<string, Review>();
let activeRenderers = 0;

function pruneReviews() {
  for (const [id, review] of reviews) if (review.expires < Date.now() && review.state !== "sending") reviews.delete(id);
}
setInterval(pruneReviews, 60000).unref();
export function findLisReview(reviewId: string, userId: string): Review {
  const review = reviews.get(reviewId);
  if (!review || review.owner !== userId || review.expires < Date.now()) throw new ApiError(410, "WhatsApp review expired. Review the selected patient and bill again.");
  return review;
}

export function lisConfigurationError(input: ReviewLisMessageInput, mobile?: string): string | undefined {
  try {
    languageFor(input.templateName, env);
    if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) throw new ApiError(503, "WhatsApp credentials are not configured. Configure the backend access token and phone-number ID.");
    if (mobile) normalizeLisRecipient(mobile);
  } catch (error) { return error instanceof Error ? error.message : "WhatsApp configuration is unavailable"; }
}

async function renderPdf(reviewId: string, req: Request): Promise<Buffer> {
  const { chromium } = await import("playwright");
  const frontendOrigin = rendererOrigin(env.FRONTEND_URL);
  const apiOrigin = rendererOrigin(env.WHATSAPP_RENDER_API_ORIGIN);
  let browser;
  let stage = "browser startup";
  try {
    browser = await chromium.launch({ headless: true });
    stage = "browser context creation";
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    // Only the original API origin receives this session cookie; never send it
    // to arbitrary logos/remote resources or expose it in the frontend URL.
    stage = "authenticated session setup";
    await context.addCookies([{ name: env.COOKIE_NAME, value: req.cookies[env.COOKIE_NAME], url: apiOrigin, httpOnly: true, secure: apiOrigin.startsWith("https:"), sameSite: env.COOKIE_SAMESITE === "none" ? "None" : env.COOKIE_SAMESITE === "strict" ? "Strict" : "Lax" }]);
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if ([frontendOrigin, apiOrigin].includes(url.origin) || ["data:", "blob:"].includes(url.protocol)) await route.continue();
      else await route.abort();
    });
    stage = "document tab creation";
    const page = await context.newPage();
    stage = "document page loading";
    await page.goto(new URL(`/whatsapp/document?reviewId=${encodeURIComponent(reviewId)}`, frontendOrigin).href, { waitUntil: "domcontentloaded", timeout: 60000 });
    stage = "authenticated document loading";
    await page.locator('[data-whatsapp-document="ready"]').waitFor({ timeout: 60000 });
    stage = "document asset loading";
    await page.evaluate(`(async () => {
      await document.fonts.ready;
      await Promise.all(Array.from(document.querySelectorAll(".lis-print-document img"), async (image) => {
        await image.decode();
        if (!image.naturalWidth) throw new Error("Document image unavailable");
      }));
    })()`);
    await page.emulateMedia({ media: "print" });
    // The document-only route has no print dialog to mask the application body
    // background. Keep the PDF page white and omit development overlays.
    await page.addStyleTag({ content: "@media print { html, body { background: white !important; height: auto !important; min-height: 0 !important; } nextjs-portal { display: none !important; } }" });
    stage = "A4 PDF rendering";
    const pdf = await page.pdf({ format: "A4", preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false });
    if (pdf.length > 16 * 1024 * 1024 || !pdf.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("Invalid generated PDF");
    return pdf;
  } catch (error) {
    const diagnostic = pdfFailure(stage, error);
    console.error("[WhatsApp PDF]", { stage, code: diagnostic.code, platform: process.platform,
      browserPath: chromium.executablePath(), detail: diagnostic.detail });
    throw new ApiError(503, diagnostic.message);
  } finally {
    await browser?.close().catch(() => console.error("[WhatsApp PDF] Browser cleanup failed"));
  }
}

export async function reviewLisMessage(input: ReviewLisMessageInput, req: Request) {
  pruneReviews();
  if (reviews.size >= 30) throw new ApiError(429, "Too many document reviews are open. Wait for an existing review to expire.");
  const context = await loadLisContext(input, req.user!.name);
  const needsPdf = LIS_TEMPLATES[input.templateName].document;
  if (needsPdf && activeRenderers >= 2) throw new ApiError(429, "Documents are being prepared. Please retry shortly.");
  const id = randomUUID();
  const review: Review = { owner: req.user!.id, input, printedBy: req.user!.name, expires: Date.now() + 10 * 60 * 1000,
    context, digest: fingerprint(context), state: "review", rendering: true };
  reviews.set(id, review);
  try {
    if (needsPdf) {
      activeRenderers++;
      let pdf: Buffer;
      try { pdf = await renderPdf(id, req); }
      finally { activeRenderers--; }
      const retainedBytes = [...reviews.values()].reduce((sum, row) => sum + (row.pdf?.length ?? 0), 0);
      if (retainedBytes + pdf.length > 64 * 1024 * 1024) throw new ApiError(429, "Document review capacity reached. Wait for an existing review to expire.");
      review.pdf = pdf;
      review.filename = `${context.billNumber}-${input.templateName === "lab_report_ready" ? "report" : "invoice"}.pdf`.replace(/[^a-zA-Z0-9._-]/g, "_");
    }
    review.rendering = false;
    return { reviewId: id, ...context, document: undefined, templateName: input.templateName,
      languageCode: env[LIS_TEMPLATES[input.templateName].languageSetting] || null,
      configurationError: lisConfigurationError(input, context.mobile) ?? null,
      attachment: review.pdf ? { filename: review.filename, base64: review.pdf.toString("base64"), mimeType: "application/pdf" } : null };
  } catch (error) { reviews.delete(id); throw error; }
}

export function lisDocumentData(reviewId: string, userId: string) {
  const review = findLisReview(reviewId, userId);
  if (!review.rendering) throw new ApiError(410, "Document rendering job has finished");
  return { ...review.context.document, templateName: review.input.templateName };
}

export async function sendLisReview(reviewId: string, req: Request) {
  const review = findLisReview(reviewId, req.user!.id);
  if (review.state === "sent") return review.result!;
  if (review.state !== "review" || review.rendering) throw new ApiError(409, "This send is already in progress or has been attempted. Do not submit it again.");
  const error = lisConfigurationError(review.input, review.context.mobile);
  if (error) throw new ApiError(503, error);
  // Set synchronously before awaits so two clicks cannot send the same review.
  review.state = "sending";
  let attempted = false;
  try {
    const latest = await loadLisContext(review.input, review.printedBy);
    if (fingerprint(latest) !== review.digest) throw new ApiError(409, "Patient, bill, result or centre information changed. Review the document again before sending.");
    if (LIS_TEMPLATES[review.input.templateName].document && !review.pdf) throw new ApiError(422, "The actual generated PDF is unavailable");
    const mediaId = review.pdf ? await uploadLisPdf(review.pdf, review.filename!) : undefined;
    // Recheck report availability and dues after PDF upload as well.
    if (review.input.templateName === "lab_report_ready") await assertResultReportAllowed(review.input.billId, review.input.testIds, review.input.workflow !== "lab-reprint");
    attempted = true;
    const result = await sendWhatsAppTemplateMessage({ to: latest.mobile, templateName: review.input.templateName,
      languageCode: languageFor(review.input.templateName, env),
      components: templateComponents(review.input.templateName, latest.variables, mediaId, review.filename) });
    review.result = result; review.state = "sent";
    console.log("[WhatsApp Outgoing]", { templateName: review.input.templateName, metaMessageId: result.metaMessageId, workflow: review.input.workflow ?? "parameter-results", recipient: maskedRecipient(latest.mobile), status: "accepted" });
    // Never downgrade a delivery/read status already received by the webhook.
    try {
      await WhatsAppMessage.updateOne({ metaMessageId: result.metaMessageId }, {
        $set: { patientId: review.input.patientId, billId: review.input.billId, templateName: review.input.templateName,
          workflow: review.input.workflow ?? "parameter-results", templateLanguage: languageFor(review.input.templateName, env), phoneNumber: latest.mobile, waId: result.waId },
        $setOnInsert: { direction: "OUTBOUND", messageType: "template", status: "accepted" },
      }, { upsert: true }).exec();
    } catch { console.error("[WhatsApp] Accepted message delivery log could not be persisted"); }
    await recordAudit({ user: req.user!.id, entityType: "LabBill", entity: review.input.billId, action: `whatsapp.${review.input.templateName}.accepted`,
      details: { patientId: review.input.patientId, billId: review.input.billId, phoneNumber: latest.mobile,
        workflow: review.input.workflow ?? "parameter-results", templateName: review.input.templateName, centreName: latest.centreName, messageType: "template", status: "accepted", metaMessageId: result.metaMessageId } });
    return result;
  } catch (error) {
    review.state = "failed";
    const metaErrorCode = error instanceof ApiError ? (error.details as { metaErrorCode?: string } | undefined)?.metaErrorCode : undefined;
    await recordAudit({ user: req.user!.id, entityType: "LabBill", entity: review.input.billId,
      action: `whatsapp.${review.input.templateName}.failed_or_unconfirmed`,
      details: { patientId: review.input.patientId, billId: review.input.billId, phoneNumber: review.context.mobile,
        workflow: review.input.workflow ?? "parameter-results", templateName: review.input.templateName, centreName: review.context.centreName, messageType: "template",
        errorCode: metaErrorCode, status: metaErrorCode === "131049" ? "failed" : attempted ? "failed_or_unconfirmed" : "blocked", errorMessage: error instanceof Error ? error.message.slice(0, 1000) : "Unknown error" } });
    if (metaErrorCode === "131049") throw error;
    if (attempted && error instanceof ApiError) throw new ApiError(error.statusCode, `${error.message} Check template approval/availability in Meta. No fallback template was used; verify message status before retrying.`);
    throw error;
  }
}
