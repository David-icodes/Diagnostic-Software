import type { Request, Response } from "express";
import { asyncHandler } from "../../../utils/async-handler";
import { ApiError } from "../../../utils/api-error";
import { sendSuccess } from "../../../utils/http";
import { listGeneratedLabBills as listGeneratedLabBillsService } from "../services/generated-lab-bills.service";
import { generatedLabBillsQuerySchema } from "../validations/generated-lab-bills";

export const listGeneratedLabBills = asyncHandler(
  async (req: Request, res: Response) => {
    const parsed = generatedLabBillsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
      throw new ApiError(400, "Invalid report query", details);
    }
    const result = await listGeneratedLabBillsService(parsed.data);
    return sendSuccess(res, result);
  },
);