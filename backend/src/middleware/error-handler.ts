import type { ErrorRequestHandler } from "express";
import { ApiError } from "../utils/api-error";

export const errorHandler: ErrorRequestHandler = (
  err,
  _req,
  res,
  _next,
) => {
  let statusCode = 500;
  let message = "Internal server error";
  let details: unknown;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    details = err.details;
  } else if (
    err instanceof Error &&
    (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError")
  ) {
    statusCode = 401;
    message = "Your session has expired. Please log in again.";
  } else {
    console.error("[error]", err);
  }

  const body: Record<string, unknown> = { success: false, message };
  if (details !== undefined) {
    body.details = details;
  }

  return res.status(statusCode).json(body);
};