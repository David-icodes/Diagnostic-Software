import type { Request, Response } from "express";
import { asyncHandler } from "../../../utils/async-handler";
import { ApiError } from "../../../utils/api-error";
import { sendSuccess } from "../../../utils/http";
import { listBillsWiseCollection as service } from "../services/bills-wise-collection.service";
import { billsWiseCollectionQuerySchema } from "../validations/bills-wise-collection";

export const listBillsWiseCollection = asyncHandler(
  async (req: Request, res: Response) => {
    const parsed = billsWiseCollectionQuerySchema.safeParse(req.query);
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