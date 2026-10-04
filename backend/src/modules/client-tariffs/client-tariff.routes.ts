import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/require-permission";
import { validate } from "../../middleware/validate";
import { applyClientTariffSchema } from "../../validations/client-tariff";
import {
  applyClientTariffs,
  listClientTariffs,
} from "./client-tariff.controller";

const router = Router();

router.use(authenticate);

router.get("/", requirePermission("lab.client_tariff.read"), listClientTariffs);
router.put(
  "/apply",
  requirePermission("lab.client_tariff.write"),
  validate(applyClientTariffSchema),
  applyClientTariffs,
);

export default router;