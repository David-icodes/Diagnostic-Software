import type { Request, Response } from "express";
import type { z } from "zod";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/http";
import { requireUserId } from "../../utils/require-user-id";
import { recordAudit } from "../audit/audit.service";
import {
  createParameter as createParameterService,
  createReferenceMapping as createReferenceMappingService,
  deleteParameter as deleteParameterService,
  deleteReferenceMapping as deleteReferenceMappingService,
  getParameter as getParameterService,
  listParameters as listParametersService,
  listReferenceMappings as listReferenceMappingsService,
  listSubtitles as listSubtitlesService,
  setParameterActive as setParameterActiveService,
  updateParameter as updateParameterService,
  updateReferenceMapping as updateReferenceMappingService,
} from "./lab-test-parameter.service";
import type {
  CreateParameterInput,
  UpdateParameterInput,
} from "./lab-test-parameter.service";
import type {
  createReferenceMappingSchema,
  updateReferenceMappingSchema,
} from "../../validations/lab-test-parameter";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export const listParameters = asyncHandler(async (req: Request, res: Response) => {
  const page = parsePositiveInt(req.query.page, DEFAULT_PAGE);
  const limit = Math.min(parsePositiveInt(req.query.limit, DEFAULT_LIMIT), MAX_LIMIT);
  const result = await listParametersService({
    departmentId: typeof req.query.departmentId === "string" ? req.query.departmentId : undefined,
    testId: typeof req.query.testId === "string" ? req.query.testId : undefined,
    mode: typeof req.query.mode === "string" ? req.query.mode : undefined,
    search: typeof req.query.search === "string" ? req.query.search : undefined,
    review: typeof req.query.review === "string" ? req.query.review : undefined,
    page,
    limit,
  });
  return sendSuccess(res, result);
});

export const listSubtitles = asyncHandler(async (req: Request, res: Response) => {
  const testId = typeof req.query.testId === "string" ? req.query.testId : "";
  const subtitles = await listSubtitlesService(testId);
  return sendSuccess(res, { subtitles });
});

export const getParameter = asyncHandler(async (req: Request, res: Response) => {
  const parameter = await getParameterService(req.params.id);
  return sendSuccess(res, { parameter });
});

export const createParameter = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const parameter = await createParameterService(
    userId,
    req.body as CreateParameterInput,
  );
  await recordAudit({
    user: userId,
    action: "lab_parameter.created",
    entityType: "LabTestParameter",
    entity: parameter._id,
  });
  return res.status(201).json({
    success: true,
    message: "Lab test parameter created successfully",
    data: { parameter },
  });
});

export const updateParameter = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const parameter = await updateParameterService(
    req.params.id,
    userId,
    req.body as UpdateParameterInput,
  );
  await recordAudit({
    user: userId,
    action: "lab_parameter.updated",
    entityType: "LabTestParameter",
    entity: parameter._id,
  });
  return sendSuccess(res, { parameter });
});

export const activateParameter = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parameter = await setParameterActiveService(req.params.id, userId, true);
    return sendSuccess(res, { parameter });
  },
);

export const deactivateParameter = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parameter = await setParameterActiveService(req.params.id, userId, false);
    return sendSuccess(res, { parameter });
  },
);

export const listReferenceMappings = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await listReferenceMappingsService(req.params.id);
    return sendSuccess(res, result);
  },
);

export const createReferenceMapping = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parameter = await createReferenceMappingService(
      req.params.id,
      userId,
      req.body as z.infer<typeof createReferenceMappingSchema>,
    );
    return res.status(201).json({
      success: true,
      message: "Reference mapping added successfully",
      data: { parameter },
    });
  },
);

export const updateReferenceMapping = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parameter = await updateReferenceMappingService(
      req.params.id,
      req.params.mappingId,
      userId,
      req.body as Partial<z.infer<typeof updateReferenceMappingSchema>>,
    );
    return sendSuccess(res, { parameter });
  },
);

export const deleteReferenceMapping = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const parameter = await deleteReferenceMappingService(
      req.params.id,
      req.params.mappingId,
      userId,
    );
    return sendSuccess(res, { parameter });
  },
);

export const deleteParameter = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const deleted = await deleteParameterService(req.params.id, userId);
  return sendSuccess(res, { deleted });
});