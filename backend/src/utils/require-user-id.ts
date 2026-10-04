import { ApiError } from "./api-error";
import type { Request } from "express";

export function requireUserId(req: Request): string {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }
  return userId;
}