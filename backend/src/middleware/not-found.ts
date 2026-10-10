import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/api-error";

export function notFound(req: Request, _res: Response, next: NextFunction) {
  return next(
    new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`),
  );
}