import type { Request, Response } from "express";
import { asyncHandler } from "../../../utils/async-handler";
import { sendSuccess } from "../../../utils/http";
import { getReportOptions } from "../services/report-options.service";

export const getReportOptionsController = asyncHandler(
  async (_req: Request, res: Response) => {
    const result = await getReportOptions();
    return sendSuccess(res, result);
  },
);