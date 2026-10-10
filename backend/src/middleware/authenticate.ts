import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { User } from "../models/user.model";
import { ApiError } from "../utils/api-error";
import { verifyAuthToken } from "../utils/jwt";
import type { AuthUser } from "../types/auth";

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token: string | undefined = req.cookies?.[env.COOKIE_NAME];

    // TEMPORARY DIAGNOSTIC LOGGING (safe) — presence only, never the value.
    // Remove these [auth] lines once the session flow is fixed.
    console.log(
      `[auth] protected request ${req.method} ${req.path} cookie present=${Boolean(token)}`,
    );

    if (!token) {
      throw new ApiError(401, "Authentication required");
    }

    const payload = verifyAuthToken(token);

    const user = await User.findById(payload.sub);

    console.log(
      `[auth] protected request ${req.method} ${req.path} user found=${Boolean(user)}`,
    );

    if (!user) {
      throw new ApiError(401, "User no longer exists");
    }

    if (user.status !== "active") {
      throw new ApiError(403, "Account is not active");
    }

    req.user = user.toJSON() as unknown as AuthUser;
    return next();
  } catch (error) {
    if (req.originalUrl.split("?")[0] === "/api/whatsapp/lis/document-data") {
      // Attribute the renderer's own document request, rather than unrelated /me calls.
      console.warn("[WhatsApp PDF auth]", {
        route: "/api/whatsapp/lis/document-data", cookiePresent: Boolean(req.cookies?.[env.COOKIE_NAME]),
        reason: error instanceof Error && error.name === "TokenExpiredError" ? "session-expired"
          : error instanceof Error && error.name === "JsonWebTokenError" ? "invalid-session"
          : error instanceof ApiError && error.statusCode === 403 ? "inactive-account" : "session-rejected",
      });
    }
    return next(error);
  }
}
