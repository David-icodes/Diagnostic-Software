import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/http";
import { requireUserId } from "../../utils/require-user-id";
import {
  assignCommissionMappings as assignService,
  listCommissionMappings as listService,
} from "./commission-mapping.service";
import type { AssignCommissionMappingsInput } from "../../validations/commission-mapping";

export const listCommissionMappings = asyncHandler(
  async (req: Request, res: Response) => {
    const doctorId = typeof req.query.doctorId === "string" ? req.query.doctorId : "";
    const departmentId =
      typeof req.query.departmentId === "string" ? req.query.departmentId : "";
    const result = await listService(doctorId, departmentId);
    return sendSuccess(res, result);
  },
);

export const assignCommissionMappings = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const body = req.body as AssignCommissionMappingsInput;
    const result = await assignService(userId, body);
    return sendSuccess(res, result);
  },
);