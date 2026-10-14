import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { validate } from "../../middleware/validate";
import { changePasswordSchema, loginSchema } from "../../validations/auth";
import { changePassword, login, logout, me } from "./auth.controller";
import vendorPasswordRoutes from "./vendor-password.routes";
import { z } from "zod";
import { authenticateVendor } from "./vendor-login.service";
import { baseCookieOptions } from "./auth.controller";
import { env } from "../../config/env";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/http";

const router = Router();

router.post("/login", validate(loginSchema), login);
router.post("/vendor-login", validate(z.object({ clientCode: z.string().trim().min(1).max(80), clientName: z.string().trim().min(1).max(120), password: z.string().min(1).max(100) }).strict()), asyncHandler(async (req, res) => {
  const result = await authenticateVendor(req.body.clientCode, req.body.clientName, req.body.password);
  res.cookie(env.COOKIE_NAME, result.token, { ...baseCookieOptions(), maxAge: 7 * 24 * 60 * 60 * 1000 });
  return sendSuccess(res, { user: result.user });
}));
router.post("/logout", logout);
router.use("/vendor-users", vendorPasswordRoutes);
router.get("/me", authenticate, me);
router.post(
  "/change-password",
  authenticate,
  validate(changePasswordSchema),
  changePassword,
);

export default router;
