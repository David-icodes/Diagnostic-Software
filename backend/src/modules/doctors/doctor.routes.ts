import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/require-permission";
import { validate } from "../../middleware/validate";
import { createDoctorSchema, updateDoctorSchema } from "../../validations/doctor";
import {
  activateDoctor,
  createDoctor,
  deactivateDoctor,
  getDoctor,
  listDoctors,
  searchDoctors,
  updateDoctor,
} from "./doctor.controller";

const router = Router();

router.use(authenticate);

// Read/search stays available to all authenticated roles so billing
// screens (operator included) can pick doctors.
router.get("/", searchDoctors);
router.get("/list", listDoctors);
router.post(
  "/",
  requirePermission("database.doctor.write"),
  validate(createDoctorSchema),
  createDoctor,
);
router.get("/:id", getDoctor);
router.put(
  "/:id",
  requirePermission("database.doctor.write"),
  validate(updateDoctorSchema),
  updateDoctor,
);
router.patch(
  "/:id/activate",
  requirePermission("database.doctor.write"),
  activateDoctor,
);
router.patch(
  "/:id/deactivate",
  requirePermission("database.doctor.write"),
  deactivateDoctor,
);

export default router;