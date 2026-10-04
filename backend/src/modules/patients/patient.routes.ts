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
router.get("/:id", getPatient);
router.put("/:id", validate(updatePatientSchema), updatePatient);
router.delete("/:id", requirePermission("patient.delete"), deletePatient);

export default router;