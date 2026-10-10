import type { Request, Response } from "express";
import { asyncHandler } from "../../../utils/async-handler";
import { ApiError } from "../../../utils/api-error";
import { sendSuccess } from "../../../utils/http";
import { listOspRegistration as listOspRegistrationService } from "../services/osp-registration.service";
import { ospRegistrationQuerySchema } from "../validations/osp-registration";

export const listOspRegistration = asyncHandler(async (req: Request, res: Response) => {
  const parsed = ospRegistrationQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    throw new ApiError(400, "Invalid report query", details);
  }
  const result = await listOspRegistrationService(parsed.data);
  return sendSuccess(res, result);
});