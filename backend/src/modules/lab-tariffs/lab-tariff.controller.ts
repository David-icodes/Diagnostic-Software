import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/http";
import { requireUserId } from "../../utils/require-user-id";
import {
  listTariffs as listTariffsService,
  updateTariffs as updateTariffsService,
} from "./lab-tariff.service";
import type { BulkLabTariffInput } from "../../validations/lab-tariff";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 200;

function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export const listTariffs = asyncHandler(async (req: Request, res: Response) => {
  const page = parsePositiveInt(req.query.page, DEFAULT_PAGE);
  const limit = Math.min(parsePositiveInt(req.query.limit, DEFAULT_LIMIT), MAX_LIMIT);
  const result = await listTariffsService({
    departmentId: typeof req.query.departmentId === "string" ? req.query.departmentId : undefined,
    search: typeof req.query.search === "string" ? req.query.search : undefined,
    page,
    limit,
  });
  return sendSuccess(res, result);
});

export const bulkUpdateTariffs = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const body = req.body as BulkLabTariffInput;
    const result = await updateTariffsService(userId, body.rows);
    return sendSuccess(res, result);
  },
);