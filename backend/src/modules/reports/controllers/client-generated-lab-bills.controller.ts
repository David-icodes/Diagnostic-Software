import type { Request, Response } from "express";
import { asyncHandler } from "../../../utils/async-handler";
import { ApiError } from "../../../utils/api-error";
import { sendSuccess } from "../../../utils/http";
import { listClientGeneratedLabBills as service } from "../services/client-generated-lab-bills.service";
import { clientGeneratedLabBillsQuerySchema } from "../validations/client-generated-lab-bills";

export const listClientGeneratedLabBills = asyncHandler(
  async (req: Request, res: Response) => {
    const parsed = clientGeneratedLabBillsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
      throw new ApiError(400, "Invalid report query", details);
    }
    const result = await service(parsed.data);
    return sendSuccess(res, result);
  },
);