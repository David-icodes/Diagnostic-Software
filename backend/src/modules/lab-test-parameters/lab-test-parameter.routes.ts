import {enableCBPSyntheticConfiguration,createCBPSyntheticRun} from "./cbp-synthetic-execution.service";
import {prepareAtlasCBPNumericVersions} from "./cbp-atlas-development.service";
import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async-handler";
import { requireUserId } from "../../utils/require-user-id";
import { sendSuccess } from "../../utils/http";
import { requestCalculationReview, approveCalculationReview, configureCalculation } from "./lab-test-parameter.service";
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
const reviewSchema=z.object({calculation:createLabTestParameterSchema.innerType().shape.calculation.unwrap().unwrap(),unit:z.string().trim().max(50)}).strict();
const configureSchema=z.object({calculation:createLabTestParameterSchema.innerType().shape.calculation.unwrap().unwrap(),unit:z.string().trim().max(50)}).strict();

router.use(authenticate);
router.post("/development/cbp/enable-synthetic",requirePermission("lab.parameter.write"),validate(z.object({}).strict()),asyncHandler(async(req,res)=>sendSuccess(res,await enableCBPSyntheticConfiguration(requireUserId(req)))));
router.post("/development/cbp/synthetic-run",requirePermission("lab.parameter.write"),validate(z.object({}).strict()),asyncHandler(async(req,res)=>sendSuccess(res,await createCBPSyntheticRun(requireUserId(req)))));

router.post("/development/cbp/numeric-versions",requirePermission("lab.parameter.write"),validate(z.object({}).strict()),asyncHandler(async(req,res)=>sendSuccess(res,await prepareAtlasCBPNumericVersions(requireUserId(req)))));

router.post("/:id/calculation",requirePermission("lab.parameter.write"),validate(configureSchema),asyncHandler(async(req,res)=>sendSuccess(res,{parameter:await configureCalculation(req.params.id,requireUserId(req),req.body.calculation,req.body.unit)})));
router.post("/:id/calculation-review",requirePermission("lab.parameter.write"),validate(reviewSchema),asyncHandler(async(req,res)=>sendSuccess(res,{parameter:await requestCalculationReview(req.params.id,requireUserId(req),req.body.calculation,req.body.unit)})));
router.post("/:id/calculation-approve",requirePermission("lab.calculation.approve"),validate(z.object({requestId:z.string().uuid()}).strict()),asyncHandler(async(req,res)=>sendSuccess(res,{parameter:await approveCalculationReview(req.params.id,requireUserId(req),req.body.requestId)})));

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
