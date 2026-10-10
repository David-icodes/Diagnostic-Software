import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/require-permission";
import {
  getTechnicianById,
  listTechnicians,
} from "./lab-technician.controller";

const router = Router();

router.use(authenticate);

router.get("/", requirePermission("test_results.view"), listTechnicians);
router.get("/:id", requirePermission("test_results.view"), getTechnicianById);

export default router;