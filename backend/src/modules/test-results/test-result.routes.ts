import { Router, raw } from "express";
import { uploadReport, listUploads, downloadUpload } from "./report-upload.controller";
import { ApiError } from "../../utils/api-error";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";
import { requirePermission } from "../../middleware/require-permission";
import { submitResultsSchema } from "../../validations/test-result";
import {
  getBillResultEntry,
  listTestParameters,
  listTestResults,
  submitTestResults,
  getResultWorkflow,
  checkReportEligibility,
} from "./test-result.controller";

const router = Router();

router.use(authenticate);
router.get("/report-uploads", requirePermission("test_results.view"), listUploads);
const parseReport = raw({ type: "application/pdf", limit: "5mb" });
router.post("/report-uploads", requirePermission("test_results.enter"), (req, res, next) => {
  parseReport(req, res, (error?: { type?: string }) => next(error
    ? error.type === "entity.too.large" ? new ApiError(413, "Select a PDF report up to 5 MB.") : error
    : undefined));
}, uploadReport);
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
