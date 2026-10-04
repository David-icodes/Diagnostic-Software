import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/http";
import { requireUserId } from "../../utils/require-user-id";
import {
  listLabSamples as listLabSamplesService,
  updateLabSampleStatus as updateLabSampleStatusService,
} from "./lab-sample.service";
import type { UpdateSampleStatusInput } from "../../validations/test-result";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 100;

function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export const listLabSamples = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const mode = req.query.mode === "criteria" ? "criteria" : "today";
  const result = await listLabSamplesService({
    userId,
    page: parsePositiveInt(req.query.page, DEFAULT_PAGE),
    limit: parsePositiveInt(req.query.limit, DEFAULT_LIMIT),
    mode,
    fromDate: optionalString(req.query.fromDate),
    toDate: optionalString(req.query.toDate),
    billNumber: optionalString(req.query.billNumber),
    patientId: optionalString(req.query.patientId),
    patientName: optionalString(req.query.patientName),
  });
  return sendSuccess(res, result);
});

export const updateSampleStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const sample = await updateLabSampleStatusService(
      userId,
      req.params.id,
      req.body as UpdateSampleStatusInput,
    );
    return res.status(200).json({
      success: true,
      message: "Sample status updated successfully",
      data: { sample },
    });
  },
);