import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import {
  getDueBills,
  getSummary,
  getTodayBills,
} from "./dashboard.controller";

const router = Router();

router.use(authenticate);

router.get("/summary", getSummary);
router.get("/today-bills", getTodayBills);
router.get("/due-bills", getDueBills);

export default router;