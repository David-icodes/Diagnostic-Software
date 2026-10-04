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

export default router;