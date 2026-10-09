import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";
import { requirePermission } from "../../middleware/require-permission";
import { updateSampleOutsideSchema } from "../../validations/sample-outside";
import { updateSampleStatusSchema } from "../../validations/test-result";
import {
  updateSampleOutside,
  listLabSamples,
  updateSampleStatus,
} from "./lab-sample.controller";

const router = Router();

router.use(authenticate);

router.get("/", requirePermission("sample.view"), listLabSamples);
router.patch(
  "/:id/status",
  requirePermission("sample.update"),
  validate(updateSampleStatusSchema),
  updateSampleStatus,
);

router.patch("/:id/outside", requirePermission("sample.update"), validate(updateSampleOutsideSchema), updateSampleOutside);

export default router;