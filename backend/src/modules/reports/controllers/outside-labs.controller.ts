import { requireUserId } from "../../../utils/require-user-id";
import { saveOutsideLab, deleteOutsideLab as removeOutsideLab } from "../services/outside-labs.service";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../utils/async-handler";
import { sendSuccess } from "../../../utils/http";
import { listOutsideLabs as service } from "../services/outside-labs.service";

export const listOutsideLabs = asyncHandler(async (_req: Request, res: Response) => {
  const result = await service();
  return sendSuccess(res, result);
});
export const createOutsideLab = asyncHandler(async (req: Request, res: Response) => {
  const lab = await saveOutsideLab(requireUserId(req), req.body);
  return res.status(201).json({ success: true, data: lab });
});
export const updateOutsideLab = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, await saveOutsideLab(requireUserId(req), req.body, req.params.id)));
export const deleteOutsideLab = asyncHandler(async (req: Request, res: Response) => {
  requireUserId(req); await removeOutsideLab(req.params.id);
  return sendSuccess(res, { deleted: true });
});
