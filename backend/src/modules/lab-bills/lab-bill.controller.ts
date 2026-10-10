import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/http";
import { requireUserId } from "../../utils/require-user-id";
import {
  cancelLabBill as cancelLabBillService,
  collectLabDue as collectLabDueService,
  createLabBill as createLabBillService,
  getLabBill as getLabBillService,
  getLabBillByBillNumber as getLabBillByBillNumberService,
  listDueBills as listDueBillsService,
  listLabBills as listLabBillsService,
  modifyLabBill as modifyLabBillService,
} from "./lab-bill.service";
import type {
  CancelLabBillInput,
  CollectLabDueInput,
  CreateLabBillInput,
  ModifyLabBillInput,
} from "../../validations/lab-bill";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export const listLabBills = asyncHandler(async (req: Request, res: Response) => {
  const result = await listLabBillsService({
    page: parsePositiveInt(req.query.page, DEFAULT_PAGE),
    limit: Math.min(parsePositiveInt(req.query.limit, DEFAULT_LIMIT), MAX_LIMIT),
    search: optionalString(req.query.search),
    status: optionalString(req.query.status),
    fromDate: optionalString(req.query.fromDate),
    toDate: optionalString(req.query.toDate),
    billType: optionalString(req.query.billType),
  });
  return sendSuccess(res, result);
});

export const listDueBills = asyncHandler(async (req: Request, res: Response) => {
  const result = await listDueBillsService({
    page: parsePositiveInt(req.query.page, DEFAULT_PAGE),
    limit: Math.min(parsePositiveInt(req.query.limit, DEFAULT_LIMIT), MAX_LIMIT),
    fromDate: optionalString(req.query.fromDate),
    toDate: optionalString(req.query.toDate),
    patientId: optionalString(req.query.patientId),
    patientName: optionalString(req.query.patientName),
    billNumber: optionalString(req.query.billNumber),
  });
  return sendSuccess(res, result);
});

export const getLabBill = asyncHandler(async (req: Request, res: Response) => {
  const bill = await getLabBillService(req.params.id);
  return sendSuccess(res, { bill });
});

export const getLabBillByBillNumber = asyncHandler(
  async (req: Request, res: Response) => {
    const bill = await getLabBillByBillNumberService(req.params.billNumber);
    return sendSuccess(res, { bill });
  },
);

export const createLabBill = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const bill = await createLabBillService(userId, req.body as CreateLabBillInput);
  return res.status(201).json({
    success: true,
    message: "Lab bill created successfully",
    data: { bill },
  });
});

export const cancelLabBill = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const bill = await cancelLabBillService(
    userId,
    req.params.id,
    (req.body as CancelLabBillInput).cancellationRemarks,
  );
  return res.status(200).json({
    success: true,
    message: "Lab bill cancelled successfully",
    data: { bill },
  });
});

export const collectLabDue = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const bill = await collectLabDueService(
    userId,
    req.params.id,
    req.body as CollectLabDueInput,
  );
  return res.status(200).json({
    success: true,
    message: "Due collection recorded successfully",
    data: { bill },
  });
});

export const modifyLabBill = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const bill = await modifyLabBillService(
    userId,
    req.params.id,
    req.body as ModifyLabBillInput,
  );
  return res.status(200).json({
    success: true,
    message: "Lab bill modified successfully",
    data: { bill },
  });
});