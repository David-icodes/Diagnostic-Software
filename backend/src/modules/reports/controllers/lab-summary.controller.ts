import type { Request, Response } from "express";
import { asyncHandler } from "../../../utils/async-handler";
import { ApiError } from "../../../utils/api-error";
import { sendSuccess } from "../../../utils/http";
import { listLabSummary as listLabSummaryService } from "../services/lab-summary.service";
import { labSummaryQuerySchema } from "../validations/lab-summary";

export const listLabSummary = asyncHandler(async (req: Request, res: Response) => {
  const parsed = labSummaryQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    throw new ApiError(400, "Invalid report query", details);
  }
  const result = await listLabSummaryService(parsed.data);
  return sendSuccess(res, result);
});