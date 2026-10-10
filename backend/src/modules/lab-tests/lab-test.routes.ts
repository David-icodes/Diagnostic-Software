import { z } from "zod";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/http";
import { requireUserId } from "../../utils/require-user-id";
import { createSpecimenOption } from "./lab-test.service";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";
import { requirePermission } from "../../middleware/require-permission";
import {
  createLabTestSchema,
  updateLabTestSchema,
} from "../../validations/lab-test";
import {
  createTest,
  deactivateTest,
  activateTest,
  getTest,
  listSpecimenOptions,
  listTests,
  updateTest,
} from "./lab-test.controller";

const router = Router();

router.use(authenticate);

// Test lookup is needed by billing and results flows (including operators),
// so it stays authenticate-only like GET /departments.
router.get("/", listTests);
router.get("/specimen-options", listSpecimenOptions);
router.post("/specimen-options", requirePermission("lab.test.write"), validate(z.object({ kind: z.enum(["sample", "tube"]), name: z.string().trim().min(1).max(50) }).strict()), asyncHandler(async (req, res) => sendSuccess(res, await createSpecimenOption(requireUserId(req), req.body), 201)));
router.get("/:id", getTest);

router.post(
  "/",
  requirePermission("lab.test.write"),
  validate(createLabTestSchema),
  createTest,
);
router.put(
  "/:id",
  requirePermission("lab.test.write"),
  validate(updateLabTestSchema),
  updateTest,
);
router.patch(
  "/:id/deactivate",
  requirePermission("lab.test.write"),
  deactivateTest,
);
router.patch(
  "/:id/activate",
  requirePermission("lab.test.write"),
  activateTest,
);

export default router;