import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/http";
import { requireUserId } from "../../utils/require-user-id";
import {
  createDoctorDesignation as createService,
  getDoctorDesignation as getService,
  listDoctorDesignations as listService,
  setDoctorDesignationActive as setActiveService,
  updateDoctorDesignation as updateService,
} from "./doctor-designation.service";
import type {
  CreateDoctorDesignationInput,
  UpdateDoctorDesignationInput,
} from "./doctor-designation.service";

export const listDoctorDesignations = asyncHandler(async (req: Request, res: Response) => {
  const result = await listService({
    page: typeof req.query.page === "string" ? Number(req.query.page) : undefined,
    limit: typeof req.query.limit === "string" ? Number(req.query.limit) : undefined,
    search: typeof req.query.search === "string" ? req.query.search : undefined,
    status: typeof req.query.status === "string" ? req.query.status : undefined,
  });
  return sendSuccess(res, result);
});

export const getDoctorDesignation = asyncHandler(async (req: Request, res: Response) => {
  const record = await getService(req.params.id);
  return sendSuccess(res, { designation: record });
});

export const createDoctorDesignation = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const record = await createService(userId, req.body as CreateDoctorDesignationInput);
  return res.status(201).json({
    success: true,
    message: "Doctor designation created successfully",
    data: { designation: record },
  });
});

export const updateDoctorDesignation = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const record = await updateService(req.params.id, userId, req.body as UpdateDoctorDesignationInput);
  return sendSuccess(res, { designation: record });
});

export const activateDoctorDesignation = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const record = await setActiveService(req.params.id, userId, true);
  return sendSuccess(res, { designation: record });
});

export const deactivateDoctorDesignation = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const record = await setActiveService(req.params.id, userId, false);
  return sendSuccess(res, { designation: record });
});