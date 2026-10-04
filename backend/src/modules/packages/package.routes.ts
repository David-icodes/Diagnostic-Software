import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/require-permission";
import { validate } from "../../middleware/validate";
import {
  createPackageSchema,
  updatePackageSchema,
} from "../../validations/package";
import {
  activatePackage,
  createPackage,
  deactivatePackage,
  getPackage,
  listPackages,
  updatePackage,
} from "./package.controller";

const router = Router();

router.use(authenticate);

router.get("/", requirePermission("database.package.read"), listPackages);
router.post(
  "/",
  requirePermission("database.package.write"),
  validate(createPackageSchema),
  createPackage,
);
router.get("/:id", requirePermission("database.package.read"), getPackage);
router.put(
  "/:id",
  requirePermission("database.package.write"),
  validate(updatePackageSchema),
  updatePackage,
);
router.patch(
  "/:id/activate",
  requirePermission("database.package.write"),
  activatePackage,
);
router.patch(
  "/:id/deactivate",
  requirePermission("database.package.write"),
  deactivatePackage,
);

export default router;