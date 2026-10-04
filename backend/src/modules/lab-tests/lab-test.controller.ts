import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/http";
import { requireUserId } from "../../utils/require-user-id";
import {
  createTest as createTestService,
  getTest as getTestService,
  listTestSpecimenOptions as listSpecimenOptionsService,
  listTests as listTestsService,
  setTestActive as setTestActiveService,
  updateTest as updateTestService,
} from "./lab-test.service";
import type { CreateLabTestInput, UpdateLabTestInput } from "./lab-test.service";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export const listTests = asyncHandler(async (req: Request, res: Response) => {
  const page = parsePositiveInt(req.query.page, DEFAULT_PAGE);
  const limit = Math.min(parsePositiveInt(req.query.limit, DEFAULT_LIMIT), MAX_LIMIT);
  const result = await listTestsService({
    departmentId: typeof req.query.departmentId === "string" ? req.query.departmentId : undefined,
    search: typeof req.query.search === "string" ? req.query.search : undefined,
    status: typeof req.query.status === "string" ? req.query.status : undefined,
    page,
    limit,
  });
  return sendSuccess(res, result);
});

export const getTest = asyncHandler(async (req: Request, res: Response) => {
  const test = await getTestService(req.params.id);
  return sendSuccess(res, { test });
});

export const listSpecimenOptions = asyncHandler(
  async (_req: Request, res: Response) => {
    const options = await listSpecimenOptionsService();
    return sendSuccess(res, options);
  },
);

export const activateTest = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const test = await setTestActiveService(req.params.id, userId, true);
  return sendSuccess(res, { test });
});

export const deactivateTest = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const test = await setTestActiveService(req.params.id, userId, false);
    return sendSuccess(res, { test });
  },
);

export const createTest = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const test = await createTestService(userId, req.body as CreateLabTestInput);
  return res.status(201).json({
    success: true,
    message: "Lab test created successfully",
    data: { test },
  });
});

export const updateTest = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const test = await updateTestService(req.params.id, userId, req.body as UpdateLabTestInput);
  return sendSuccess(res, { test });
});