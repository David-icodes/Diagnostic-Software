import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/http";
import { requireUserId } from "../../utils/require-user-id";
import {
  applyClientTariffs as applyService,
  listClientTariffs as listService,
} from "./client-tariff.service";
import type { ApplyClientTariffInput } from "../../validations/client-tariff";

export const listClientTariffs = asyncHandler(
  async (req: Request, res: Response) => {
    const clientId = typeof req.query.clientId === "string" ? req.query.clientId : "";
    const departmentId =
      typeof req.query.departmentId === "string" ? req.query.departmentId : "";
    const result = await listService(clientId, departmentId);
    return sendSuccess(res, result);
  },
);

export const applyClientTariffs = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const body = req.body as ApplyClientTariffInput;
    const result = await applyService(userId, body);
    return sendSuccess(res, result);
  },
);