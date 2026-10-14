import { SampleCollection } from "../../models/sample-collection.model";
import { Types } from "mongoose";
import { ApiError } from "../../utils/api-error";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/http";
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

router.get("/:id/collections", requirePermission("test_results.view"), asyncHandler(async(req,res)=>{
 if(!Types.ObjectId.isValid(req.params.id))throw new ApiError(400,"Invalid sample ID");
 return sendSuccess(res,await SampleCollection.find({sampleId:req.params.id}).sort({_id:1}).exec());
}));
router.get("/", requirePermission("sample.view"), listLabSamples);
router.patch(
  "/:id/status",
  requirePermission("sample.update"),
  validate(updateSampleStatusSchema),
  updateSampleStatus,
);

router.patch("/:id/outside", requirePermission("sample.update"), validate(updateSampleOutsideSchema), updateSampleOutside);

export default router;