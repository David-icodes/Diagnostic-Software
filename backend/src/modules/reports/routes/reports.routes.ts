import { asyncHandler } from "../../../utils/async-handler";
import { sendSuccess } from "../../../utils/http";
import { tableExportSchema, exportTable } from "../services/table-export.service";
import { validate } from "../../../middleware/validate";
import { outsideLabInputSchema } from "../services/outside-labs.service";
import { createOutsideLab, updateOutsideLab, deleteOutsideLab } from "../controllers/outside-labs.controller";
import { Router } from "express";
import { authenticate } from "../../../middleware/authenticate";
import { requirePermission } from "../../../middleware/require-permission";
import { listGeneratedLabBills } from "../controllers/generated-lab-bills.controller";
import { listLabSummary } from "../controllers/lab-summary.controller";
import { listOspRegistration } from "../controllers/osp-registration.controller";
import { listReferralDoctorCommission } from "../controllers/referral-doctor-commission.controller";
import { listLabCollectionSummary } from "../controllers/lab-collection-summary.controller";
import { listClientGeneratedLabBills } from "../controllers/client-generated-lab-bills.controller";
import { listOutsideSentLabTests } from "../controllers/outside-sent-lab-tests.controller";
import { listOutsideLabs } from "../controllers/outside-labs.controller";
import { listDueBills } from "../controllers/due-bills.controller";
import { listCancelledBills } from "../controllers/cancelled-bills.controller";
import { listBillsWiseCollection } from "../controllers/bills-wise-collection.controller";
import { listHospitalPriceCard } from "../controllers/hospital-price-card.controller";
import { getReportOptionsController } from "../controllers/report-options.controller";

const router = Router();

router.use(authenticate);

router.get(
  "/generated-lab-bills",
  requirePermission("reports.generated_bills"),
  listGeneratedLabBills,
);

router.get("/lab-summary", requirePermission("reports.lab_summary"), listLabSummary);

router.get(
  "/osp-registration",
  requirePermission("reports.osp_registration"),
  listOspRegistration,
);

router.get(
  "/referral-doctor-commission",
  requirePermission("reports.doctor_commission"),
  listReferralDoctorCommission,
);

router.get(
  "/lab-collection-summary",
  requirePermission("reports.collection"),
  listLabCollectionSummary,
);

router.get(
  "/client-generated-lab-bills",
  requirePermission("reports.client_bills"),
  listClientGeneratedLabBills,
);

router.get(
  "/outside-sent-lab-tests",
  requirePermission("reports.outside_sent"),
  listOutsideSentLabTests,
);

router.get("/outside-labs", requirePermission("reports.outside_sent"), listOutsideLabs);

router.get("/options", requirePermission("reports.view"), getReportOptionsController);

router.get("/due-bills", requirePermission("reports.dues"), listDueBills);

router.get(
  "/cancelled-bills",
  requirePermission("reports.cancelled_bills"),
  listCancelledBills,
);

router.get(
  "/bills-wise-collection",
  requirePermission("reports.bill_collection"),
  listBillsWiseCollection,
);

router.get(
  "/hospital-price-card",
  requirePermission("reports.price_card"),
  listHospitalPriceCard,
);

// Master writes use the existing database-management permission, not report read permission.
router.post("/outside-labs", requirePermission("database.department.write"), validate(outsideLabInputSchema), createOutsideLab);
router.put("/outside-labs/:id", requirePermission("database.department.write"), validate(outsideLabInputSchema), updateOutsideLab);
router.delete("/outside-labs/:id", requirePermission("database.department.write"), deleteOutsideLab);
router.post("/table-export", requirePermission("reports.view"), validate(tableExportSchema), asyncHandler(async (req, res) => {
  const buffer = await exportTable(req.body);
  return sendSuccess(res, { content: buffer.toString("base64"), format: req.body.format });
}));
export default router;