import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/http";
import { requireUserId } from "../../utils/require-user-id";
import {
  createDoctorSpecialisation as createService,
  getDoctorSpecialisation as getService,
  listDoctorSpecialisations as listService,
  setDoctorSpecialisationActive as setActiveService,
  updateDoctorSpecialisation as updateService,
} from "./doctor-specialisation.service";
import type {
  CreateDoctorSpecialisationInput,
  UpdateDoctorSpecialisationInput,
} from "./doctor-specialisation.service";

export const listDoctorSpecialisations = asyncHandler(async (req: Request, res: Response) => {
  const result = await listService({
    page: typeof req.query.page === "string" ? Number(req.query.page) : undefined,
    limit: typeof req.query.limit === "string" ? Number(req.query.limit) : undefined,
    search: typeof req.query.search === "string" ? req.query.search : undefined,
    status: typeof req.query.status === "string" ? req.query.status : undefined,
  });
  return sendSuccess(res, result);
});

export const getDoctorSpecialisation = asyncHandler(async (req: Request, res: Response) => {
  const record = await getService(req.params.id);
  return sendSuccess(res, { specialisation: record });
});

export const createDoctorSpecialisation = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const record = await createService(userId, req.body as CreateDoctorSpecialisationInput);
  return res.status(201).json({
    success: true,
    message: "Doctor specialisation created successfully",
    data: { specialisation: record },
  });
});

export const updateDoctorSpecialisation = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const record = await updateService(req.params.id, userId, req.body as UpdateDoctorSpecialisationInput);
  return sendSuccess(res, { specialisation: record });
});

export const activateDoctorSpecialisation = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const record = await setActiveService(req.params.id, userId, true);
  return sendSuccess(res, { specialisation: record });
});

export const deactivateDoctorSpecialisation = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const record = await setActiveService(req.params.id, userId, false);
  return sendSuccess(res, { specialisation: record });
});