import type { Request, Response } from "express";
import { env } from "../../config/env";
import { asyncHandler } from "../../utils/async-handler";
import { sendMessage, sendSuccess } from "../../utils/http";
import { requireUserId } from "../../utils/require-user-id";
import { authenticateUser, changePassword as changePasswordService } from "./auth.service";

const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function baseCookieOptions() {
  const sameSite = env.COOKIE_SAMESITE;

  return {
    httpOnly: true,
    sameSite,
    // SameSite=None is only accepted by browsers together with Secure.
    secure: env.NODE_ENV === "production" || sameSite === "none",
    path: "/",
  };
}

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { username, password } = req.body as {
    username: string;
    password: string;
  };

  const { user, token } = await authenticateUser(username, password);

  const cookieOptions = {
    ...baseCookieOptions(),
    maxAge: COOKIE_MAX_AGE_MS,
  };

  // TEMPORARY DIAGNOSTIC LOGGING (safe) — cookie attributes only, never the
  // cookie value/token. Remove this [auth] line once the session flow is fixed.
  console.log(
    `[auth] session cookie configured name=${env.COOKIE_NAME} secure=${cookieOptions.secure} sameSite=${String(cookieOptions.sameSite)} httpOnly=${cookieOptions.httpOnly} path=${cookieOptions.path} maxAge=${cookieOptions.maxAge}`,
  );

  res.cookie(env.COOKIE_NAME, token, cookieOptions);

  return sendSuccess(res, { user });
});

export const logout = asyncHandler(async (_req: Request, res: Response) => {
  res.clearCookie(env.COOKIE_NAME, baseCookieOptions());
  return sendMessage(res, "Logged out successfully");
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  return sendSuccess(res, { user: req.user });
});

/** Self-service password change for the signed-in user. */
export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const { currentPassword, newPassword } = req.body as {
    currentPassword: string;
    newPassword: string;
  };
  await changePasswordService(userId, currentPassword, newPassword);
  return sendMessage(res, "Password changed successfully");
});