import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/http";
import {
  getDueBills as getDueBillsService,
  getRecentPatients as getRecentPatientsService,
  getSummary as getSummaryService,
  getTodayBills as getTodayBillsService,
} from "./dashboard.service";

function queryString(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function queryLimit(req: Request, fallback: number): number {
  const parsed = Number(req.query.limit);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(100, Math.floor(parsed));
}

export const getSummary = asyncHandler(async (req: Request, res: Response) => {
  return sendSuccess(
    res,
    await getSummaryService({ fromDate: queryString(req, "from"), toDate: queryString(req, "to") }),
  );
});

export const getTodayBills = asyncHandler(async (req: Request, res: Response) => {
  return sendSuccess(
    res,
    await getTodayBillsService({
      fromDate: queryString(req, "from"),
      toDate: queryString(req, "to"),
      limit: queryLimit(req, 10),
    }),
  );
});

export const getDueBills = asyncHandler(async (req: Request, res: Response) => {
  return sendSuccess(res, await getDueBillsService({ limit: queryLimit(req, 10) }));
});

export const getRecentPatients = asyncHandler(async (req: Request, res: Response) => {
  return sendSuccess(
    res,
    await getRecentPatientsService({
      limit: queryLimit(req, 10),
      fromDate: queryString(req, "from"),
      toDate: queryString(req, "to"),
    }),
  );
});