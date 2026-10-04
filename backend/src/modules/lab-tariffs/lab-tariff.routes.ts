import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/require-permission";
import { validate } from "../../middleware/validate";
import { bulkLabTariffSchema } from "../../validations/lab-tariff";
import {
  bulkUpdateTariffs,
  listTariffs,
} from "./lab-tariff.controller";

const router = Router();

router.use(authenticate);

router.get("/", requirePermission("lab.tariff.read"), listTariffs);
router.put(
  "/bulk",
  requirePermission("lab.tariff.write"),
  validate(bulkLabTariffSchema),
  bulkUpdateTariffs,
);

export default router;