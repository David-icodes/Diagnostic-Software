import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/require-permission";
import { validate } from "../../middleware/validate";
import {
  createDoctorSpecialisationSchema,
  updateDoctorSpecialisationSchema,
} from "../../validations/doctor-specialisation";
import {
  activateDoctorSpecialisation,
  createDoctorSpecialisation,
  deactivateDoctorSpecialisation,
  getDoctorSpecialisation,
  listDoctorSpecialisations,
  updateDoctorSpecialisation,
} from "./doctor-specialisation.controller";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  requirePermission("database.specialisation.read"),
  listDoctorSpecialisations,
);
router.post(
  "/",
  requirePermission("database.specialisation.write"),
  validate(createDoctorSpecialisationSchema),
  createDoctorSpecialisation,
);
router.get(
  "/:id",
  requirePermission("database.specialisation.read"),
  getDoctorSpecialisation,
);
router.put(
  "/:id",
  requirePermission("database.specialisation.write"),
  validate(updateDoctorSpecialisationSchema),
  updateDoctorSpecialisation,
);
router.patch(
  "/:id/activate",
  requirePermission("database.specialisation.write"),
  activateDoctorSpecialisation,
);
router.patch(
  "/:id/deactivate",
  requirePermission("database.specialisation.write"),
  deactivateDoctorSpecialisation,
);

export default router;