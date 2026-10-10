import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";
import { requirePermission } from "../../middleware/require-permission";
import {
  cancelLabBillSchema,
  createLabBillSchema,
  collectLabDueSchema,
  modifyLabBillSchema,
} from "../../validations/lab-bill";
import {
  cancelLabBill,
  collectLabDue,
  createLabBill,
  getLabBill,
  getLabBillByBillNumber,
  listDueBills,
  listLabBills,
  modifyLabBill,
} from "./lab-bill.controller";

const router = Router();

router.use(authenticate);

router.get("/", requirePermission("billing.view"), listLabBills);
router.get("/due", requirePermission("billing.view"), listDueBills);
router.get(
  "/by-bill-number/:billNumber",
  requirePermission("billing.view"),
  getLabBillByBillNumber,
);
router.post("/", requirePermission("billing.create"), validate(createLabBillSchema), createLabBill);
router.get("/:id", requirePermission("billing.view"), getLabBill);
router.put(
  "/:id",
  requirePermission("billing.modify"),
  validate(modifyLabBillSchema),
  modifyLabBill,
);
router.post(
  "/:id/cancel",
  requirePermission("billing.cancel"),
  validate(cancelLabBillSchema),
  cancelLabBill,
);
router.post(
  "/:id/collect-due",
  requirePermission("billing.collect_due"),
  validate(collectLabDueSchema),
  collectLabDue,
);

export default router;