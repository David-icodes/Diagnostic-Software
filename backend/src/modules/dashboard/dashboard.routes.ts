import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import {
  getDueBills,
  getOutstandingBills,
  getRecentPatients,
  getSummary,
  getTodayBills,
} from "./dashboard.controller";

const router = Router();

router.use(authenticate);

router.get("/summary", getSummary);
router.get("/today-bills", getTodayBills);
router.get("/due-bills", getDueBills);
router.get("/outstanding-bills", getOutstandingBills);
router.get("/recent-patients", getRecentPatients);

export default router;
