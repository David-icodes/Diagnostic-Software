import {requestSession,sessionCookieName} from "../../utils/session-scope";
import type { Request, Response } from "express";
import { env } from "../../config/env";
import { asyncHandler } from "../../utils/async-handler";
import { sendMessage, sendSuccess } from "../../utils/http";
import { requireUserId } from "../../utils/require-user-id";
import { authenticateUser, changePassword as changePasswordService } from "./auth.service";
import { verifyAuthToken } from "../../utils/jwt";
import { User } from "../../models/user.model";

const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function baseCookieOptions() {
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

  res.cookie(sessionCookieName(user.role === "vendor" ? "vendor" : "admin"), token, cookieOptions);

  return sendSuccess(res, { user });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const {token,name}=requestSession(req);
  if(typeof token==="string") {
    let subject:string|undefined;
    try { const payload=verifyAuthToken(token); if(payload.role==="vendor")subject=payload.sub; } catch { /* Expired/invalid sessions can still clear their cookie. */ }
    if(subject) await User.updateOne({_id:subject,role:"vendor"},{$inc:{sessionVersion:1}}).exec();
  }
  res.clearCookie(name, baseCookieOptions());
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
