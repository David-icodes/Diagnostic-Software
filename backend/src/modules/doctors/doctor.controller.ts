import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/http";
import { requireUserId } from "../../utils/require-user-id";
import {
  createDoctor as createDoctorService,
  getDoctor as getDoctorService,
  listDoctors as listDoctorsService,
  searchDoctors as searchDoctorsService,
  setDoctorActive as setDoctorActiveService,
  updateDoctor as updateDoctorService,
} from "./doctor.service";
import type { CreateDoctorInput, UpdateDoctorInput } from "./doctor.service";

export const searchDoctors = asyncHandler(async (req: Request, res: Response) => {
  const doctors = await searchDoctorsService({
    search: typeof req.query.search === "string" ? req.query.search : undefined,
  });
  return sendSuccess(res, doctors);
});

export const listDoctors = asyncHandler(async (req: Request, res: Response) => {
  const result = await listDoctorsService({
    page: typeof req.query.page === "string" ? Number(req.query.page) : undefined,
    limit: typeof req.query.limit === "string" ? Number(req.query.limit) : undefined,
    search: typeof req.query.search === "string" ? req.query.search : undefined,
    status: typeof req.query.status === "string" ? req.query.status : undefined,
  });
  return sendSuccess(res, result);
});

export const getDoctor = asyncHandler(async (req: Request, res: Response) => {
  const doctor = await getDoctorService(req.params.id);
  return sendSuccess(res, { doctor });
});

export const createDoctor = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const doctor = await createDoctorService(userId, req.body as CreateDoctorInput);
  return res.status(201).json({
    success: true,
    message: "Doctor created successfully",
    data: { doctor },
  });
});

export const updateDoctor = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const doctor = await updateDoctorService(req.params.id, userId, req.body as UpdateDoctorInput);
  return sendSuccess(res, { doctor });
});

export const activateDoctor = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const doctor = await setDoctorActiveService(req.params.id, userId, true);
  return sendSuccess(res, { doctor });
});

export const deactivateDoctor = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const doctor = await setDoctorActiveService(req.params.id, userId, false);
  return sendSuccess(res, { doctor });
});