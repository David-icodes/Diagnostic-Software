import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes";
import dashboardRoutes from "../modules/dashboard/dashboard.routes";

const router = Router();

router.get("/health", (_req, res) => {
  return res.json({ success: true, message: "Diagnostic LIS API is running" });
});

router.use("/auth", authRoutes);
router.use("/dashboard", dashboardRoutes);

export default router;