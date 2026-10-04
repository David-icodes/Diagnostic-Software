import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/require-permission";
import { validate } from "../../middleware/validate";
import {
  createLabTestParameterSchema,
  updateLabTestParameterSchema,
  createReferenceMappingSchema,
  updateReferenceMappingSchema,
} from "../../validations/lab-test-parameter";
import {
  activateParameter,
  createParameter,
  createReferenceMapping,
  deactivateParameter,
  deleteParameter,
  deleteReferenceMapping,
  getParameter,
  listParameters,
  listReferenceMappings,
  listSubtitles,
  updateParameter,
  updateReferenceMapping,
} from "./lab-test-parameter.controller";

const router = Router();

router.use(authenticate);

router.get("/", requirePermission("lab.parameter.read"), listParameters);
router.get("/subtitles", requirePermission("lab.parameter.read"), listSubtitles);
router.get("/:id", requirePermission("lab.parameter.read"), getParameter);

// Reference mappings live inside a parameter, so they use the same permissions.
router.get(
  "/:id/mappings",
  requirePermission("lab.parameter.read"),
  listReferenceMappings,
);
router.post(
  "/:id/mappings",
  requirePermission("lab.parameter.write"),
  validate(createReferenceMappingSchema),
  createReferenceMapping,
);
router.put(
  "/:id/mappings/:mappingId",
  requirePermission("lab.parameter.write"),
  validate(updateReferenceMappingSchema),
  updateReferenceMapping,
);
router.delete(
  "/:id/mappings/:mappingId",
  requirePermission("lab.parameter.write"),
  deleteReferenceMapping,
);

router.post(
  "/",
  requirePermission("lab.parameter.write"),
  validate(createLabTestParameterSchema),
  createParameter,
);
router.put(
  "/:id",
  requirePermission("lab.parameter.write"),
  validate(updateLabTestParameterSchema),
  updateParameter,
);
router.delete("/:id", requirePermission("lab.parameter.write"), deleteParameter);
router.patch(
  "/:id/deactivate",
  requirePermission("lab.parameter.write"),
  deactivateParameter,
);
router.patch(
  "/:id/activate",
  requirePermission("lab.parameter.write"),
  activateParameter,
);

export default router;