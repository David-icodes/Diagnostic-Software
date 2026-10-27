import {patientHistory} from "./patient-history.service";
import {asyncHandler} from "../../utils/async-handler";
import {sendSuccess} from "../../utils/http";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/require-permission";
import { validate } from "../../middleware/validate";
import {
  createPatientSchema,
  updatePatientSchema,
} from "../../validations/patient";
import {
  createPatient,
  deletePatient,
  getPatient,
  listPatients,
  updatePatient,
} from "./patient.controller";

const router = Router();

router.use(authenticate);

router.get("/", listPatients);
router.post("/", validate(createPatientSchema), createPatient);
router.get("/:id/history",requirePermission("billing.view"),asyncHandler(async(req,res)=>sendSuccess(res,await patientHistory(req.user,req.params.id,Number(req.query.page)||1))));
router.get("/:id", getPatient);
router.put("/:id", validate(updatePatientSchema), updatePatient);
router.delete("/:id", requirePermission("patient.delete"), deletePatient);

export default router;