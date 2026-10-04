import type { Request, Response } from "express";
import { asyncHandler } from "../../../utils/async-handler";
import { sendSuccess } from "../../../utils/http";
import { listOutsideLabs as service } from "../services/outside-labs.service";

export const listOutsideLabs = asyncHandler(async (_req: Request, res: Response) => {
  const result = await service();
  return sendSuccess(res, result);
});