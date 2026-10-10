import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/require-permission";
import { validate } from "../../middleware/validate";
import {
  createLocationSchema,
  updateLocationSchema,
} from "../../validations/location";
import {
  activateLocation,
  createLocation,
  deactivateLocation,
  getLocation,
  listLocations,
  updateLocation,
} from "./location.controller";

const router = Router();

router.use(authenticate);

router.get("/", requirePermission("database.location.read"), listLocations);
router.post(
  "/",
  requirePermission("database.location.write"),
  validate(createLocationSchema),
  createLocation,
);
router.get("/:id", requirePermission("database.location.read"), getLocation);
router.put(
  "/:id",
  requirePermission("database.location.write"),
  validate(updateLocationSchema),
  updateLocation,
);
router.patch(
  "/:id/activate",
  requirePermission("database.location.write"),
  activateLocation,
);
router.patch(
  "/:id/deactivate",
  requirePermission("database.location.write"),
  deactivateLocation,
);

export default router;