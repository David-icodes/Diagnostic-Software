import type { AuthUser } from "../types/auth";
import { ApiError } from "./api-error";
import { Types } from "mongoose";
export function vendorRouteAllowed(role: string, path: string): boolean {
  if (role !== "vendor") return true;
  return /^\/api\/v1\/vendor-portal(?:\/|$)/.test(path) || ["/api/v1/auth/me", "/api/v1/auth/change-password"].includes(path);
}
export function vendorClientId(user: AuthUser): string {
  if (user.role !== "vendor") throw new ApiError(403, "Sign in with a Vendor Client account to open this page.");
  if (!user.clientId || !Types.ObjectId.isValid(String(user.clientId))) throw new ApiError(403, "Vendor client assignment is required");
  return String(user.clientId);
}
