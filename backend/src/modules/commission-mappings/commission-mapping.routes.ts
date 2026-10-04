import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/require-permission";
import { validate } from "../../middleware/validate";
import { assignCommissionMappingsSchema } from "../../validations/commission-mapping";
import {
  assignCommissionMappings,
  listCommissionMappings,
} from "./commission-mapping.controller";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  requirePermission("lab.commission.read"),
  listCommissionMappings,
);
router.post(
  "/assign",
  requirePermission("lab.commission.write"),
  validate(assignCommissionMappingsSchema),
  assignCommissionMappings,
);

export default router;