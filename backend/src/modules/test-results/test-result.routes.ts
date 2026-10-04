import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";
import { requirePermission } from "../../middleware/require-permission";
import { submitResultsSchema } from "../../validations/test-result";
import {
  getBillResultEntry,
  listTestParameters,
  listTestResults,
  submitTestResults,
} from "./test-result.controller";

const router = Router();

router.use(authenticate);

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
router.post(
  "/results/submit",
  requirePermission("test_results.enter"),
  validate(submitResultsSchema),
  submitTestResults,
);

export default router;