import {requestSession} from "../utils/session-scope";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { User } from "../models/user.model";
import { ApiError } from "../utils/api-error";
import { verifyAuthToken } from "../utils/jwt";
import type { AuthUser } from "../types/auth";
import { vendorRouteAllowed } from "../utils/vendor-access";

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const {token,scope} = requestSession(req);

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

    if ((user.role === "vendor") !== (scope === "vendor")) throw new ApiError(403, "Session does not belong to this portal");

    if (user.status !== "active") {
      throw new ApiError(403, "Account is not active");
    }

    if ((payload.sessionVersion ?? 0) !== (user.sessionVersion ?? 0)) throw new ApiError(401, "Session expired. Please sign in again.");
    if (!vendorRouteAllowed(user.role, req.originalUrl.split("?")[0])) throw new ApiError(403, "This account can access only its Vendor Client Bills portal");

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
