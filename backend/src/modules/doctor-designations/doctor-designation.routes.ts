import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/require-permission";
import { validate } from "../../middleware/validate";
import {
  createDoctorDesignationSchema,
  updateDoctorDesignationSchema,
} from "../../validations/doctor-designation";
import {
  activateDoctorDesignation,
  createDoctorDesignation,
  deactivateDoctorDesignation,
  getDoctorDesignation,
  listDoctorDesignations,
  updateDoctorDesignation,
} from "./doctor-designation.controller";

const router = Router();

router.use(authenticate);

router.get("/", requirePermission("database.designation.read"), listDoctorDesignations);
router.post(
  "/",
  requirePermission("database.designation.write"),
  validate(createDoctorDesignationSchema),
  createDoctorDesignation,
);
router.get("/:id", requirePermission("database.designation.read"), getDoctorDesignation);
router.put(
  "/:id",
  requirePermission("database.designation.write"),
  validate(updateDoctorDesignationSchema),
  updateDoctorDesignation,
);
router.patch(
  "/:id/activate",
  requirePermission("database.designation.write"),
  activateDoctorDesignation,
);
router.patch(
  "/:id/deactivate",
  requirePermission("database.designation.write"),
  deactivateDoctorDesignation,
);

export default router;