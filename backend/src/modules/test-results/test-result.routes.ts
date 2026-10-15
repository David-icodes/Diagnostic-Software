import { recordAudit } from "../audit/audit.service";
import { printExternalReport } from "./external-report-print";
import { Router, raw } from "express";
import { performance } from "node:perf_hooks";
import { uploadReport, listUploads, downloadUpload } from "./report-upload.controller";
import { ApiError } from "../../utils/api-error";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";
import { requirePermission } from "../../middleware/require-permission";
import { submitResultsSchema } from "../../validations/test-result";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/http";
import { browserReportPdf, reportPdfQuery, reportRenderData } from "./report-pdf.service";
import {
  getBillResultEntry,
  listTestParameters,
  listTestResults,
  submitTestResults,
  getResultWorkflow,
  checkReportEligibility,
} from "./test-result.controller";

const router = Router();

router.use((req, res, next) => {
  if (req.method === "GET" && /^\/report-uploads\/[^/]+$/.test(req.path)) res.locals.reportAuthStarted = performance.now();
  next();
});
router.use(authenticate);
router.get("/report.pdf",requirePermission("test_results.view"),asyncHandler(async(req,res)=>{
  const parsed=reportPdfQuery.safeParse(req.query);if(!parsed.success)throw new ApiError(400,"Invalid report viewing options");
  const report=await browserReportPdf(parsed.data,req);
  res.set({"Content-Type":"application/pdf","Content-Disposition":`${parsed.data.download==="true"?"attachment":"inline"}; filename*=UTF-8''${encodeURIComponent(report.filename)}`,
    "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","X-Report-Cache":report.status});
  return res.send(report.bytes);
}));
router.get("/render-data/:jobId",requirePermission("test_results.view"),asyncHandler(async(req,res)=>{
  res.set("Cache-Control","private, no-store");return sendSuccess(res,reportRenderData(req.params.jobId,req.user!.id));
}));
router.get("/report-uploads", requirePermission("test_results.view"), listUploads);
const parseReport = raw({ type: "application/pdf", limit: "5mb" });
router.post("/report-uploads", requirePermission("test_results.enter"), (req, res, next) => {
  parseReport(req, res, (error?: { type?: string }) => next(error
    ? error.type === "entity.too.large" ? new ApiError(413, "Select a PDF report up to 5 MB.") : error
    : undefined));
}, uploadReport);
router.get("/report-uploads/:id/print", requirePermission("test_results.view"), requirePermission("reports.print"), asyncHandler(async(req,res)=>{
  const header=req.query.header ?? "header";
  if(!["header","none","letterhead"].includes(String(header)))throw new ApiError(400,"Invalid external report header option");
  const bytes=await printExternalReport(String(req.query.billId??""),String(req.query.testId??""),req.params.id,header as "header"|"none"|"letterhead",req);
  await recordAudit({user:req.user!.id,action:"report_attachment.printed",entityType:"LabReportUpload",entity:req.params.id});
  res.set({"Content-Type":"application/pdf","Content-Disposition":"inline; filename=external-report-print.pdf","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"});
  return res.send(bytes);
}));
router.get("/report-uploads/:id", requirePermission("test_results.view"), downloadUpload);

router.get(
  "/test-parameters",
  requirePermission("test_results.view"),
  listTestParameters,
);
/**
 * Bill-scoped entry point: the bill decides which ordered tests are editable
 * and the backend decides which reference range applies to its patient.
 */
router.get(
  "/bill-entry",
  requirePermission("test_results.view"),
  getBillResultEntry,
);
router.get("/results", requirePermission("test_results.view"), listTestResults);
router.get("/workflow", requirePermission("test_results.view"), getResultWorkflow);
router.get("/report-eligibility", requirePermission("test_results.view"), checkReportEligibility);
router.post(
  "/results/submit",
  requirePermission("test_results.enter"),
  validate(submitResultsSchema),
  submitTestResults,
);

export default router;
