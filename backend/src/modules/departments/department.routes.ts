import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/require-permission";
import { validate } from "../../middleware/validate";
import {
  createDepartmentSchema,
  updateDepartmentSchema,
} from "../../validations/department";
import {
  activateDepartment,
  createDepartment,
  deactivateDepartment,
  getDepartment,
  listDepartments,
  updateDepartment,
} from "./department.controller";

const router = Router();

router.use(authenticate);

// Read stays available to all authenticated roles so billing
// screens (operator included) can list departments for pickers.
router.get("/", listDepartments);
router.post(
  "/",
  requirePermission("database.department.write"),
  validate(createDepartmentSchema),
  createDepartment,
);
router.get("/:id", getDepartment);
router.put(
  "/:id",
  requirePermission("database.department.write"),
  validate(updateDepartmentSchema),
  updateDepartment,
);
router.patch(
  "/:id/activate",
  requirePermission("database.department.write"),
  activateDepartment,
);
router.patch(
  "/:id/deactivate",
  requirePermission("database.department.write"),
  deactivateDepartment,
);

export default router;