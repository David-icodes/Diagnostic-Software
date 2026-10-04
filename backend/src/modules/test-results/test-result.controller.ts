import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/http";
import { requireUserId } from "../../utils/require-user-id";
import {
  getBillResultEntry as getBillResultEntryService,
  listTestParameters as listTestParametersService,
  listTestResults as listTestResultsService,
  submitTestResults as submitTestResultsService,
} from "./test-result.service";

export const listTestParameters = asyncHandler(
  async (req: Request, res: Response) => {
    const parameters = await listTestParametersService(
      String(req.query.testId ?? ""),
    );
    return sendSuccess(res, { parameters });
  },
);

/**
 * Returns one bill's ordered tests with their parameters and the reference
 * range that applies to that bill's patient.
 */
export const getBillResultEntry = asyncHandler(
  async (req: Request, res: Response) => {
    const entry = await getBillResultEntryService(String(req.query.billId ?? ""));
    return sendSuccess(res, entry);
  },
);

export const listTestResults = asyncHandler(
  async (req: Request, res: Response) => {
    const results = await listTestResultsService(
      String(req.query.billId ?? ""),
      String(req.query.testId ?? ""),
    );
    return sendSuccess(res, { results });
  },
);

export const submitTestResults = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const result = await submitTestResultsService(userId, req.body);
    return res.status(200).json({
      success: true,
      message: "Test results submitted successfully",
      data: result,
    });
  },
);