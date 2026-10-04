import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requirePermission } from "../../middleware/require-permission";
import { getDatabaseOptions } from "./database-options.controller";

const router = Router();

router.use(authenticate);

router.get("/options", requirePermission("database.view"), getDatabaseOptions);

export default router;