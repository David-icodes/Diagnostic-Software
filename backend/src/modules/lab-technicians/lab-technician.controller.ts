import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/http";
import {
  getTechnician,
  listActiveTechnicians,
} from "./lab-technician.service";

export const listTechnicians = asyncHandler(
  async (_req: Request, res: Response) => {
    const technicians = await listActiveTechnicians();
    return sendSuccess(res, { technicians });
  },
);

export const getTechnicianById = asyncHandler(
  async (req: Request, res: Response) => {
    const technician = await getTechnician(req.params.id);
    return sendSuccess(res, { technician });
  },
);