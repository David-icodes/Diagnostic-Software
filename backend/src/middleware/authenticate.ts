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

    if (!token) {
      throw new ApiError(401, "Authentication required");
    }

    const payload = verifyAuthToken(token);

    const user = await User.findById(payload.sub);
    if (!user) {
      throw new ApiError(401, "User no longer exists");
    }

    if (user.status !== "active") {
      throw new ApiError(403, "Account is not active");
    }

    req.user = user.toJSON() as unknown as AuthUser;
    return next();
  } catch (error) {
    return next(error);
  }
}