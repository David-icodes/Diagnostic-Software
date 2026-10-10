import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/http";
import { ApiError } from "../../utils/api-error";
import {
  createPatient as createPatientService,
  deletePatient as deletePatientService,
  getPatient as getPatientService,
  listPatients as listPatientsService,
  updatePatient as updatePatientService,
} from "./patient.service";
import type { CreatePatientInput, UpdatePatientInput } from "./patient.service";

function requireUserId(req: Request): string {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(401, "Authentication required");
  }
  return userId;
}

export const listPatients = asyncHandler(async (req: Request, res: Response) => {
  const result = await listPatientsService({
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 20,
    search:
      typeof req.query.search === "string" ? req.query.search : undefined,
    status: typeof req.query.status === "string" ? req.query.status : undefined,
  });

  return sendSuccess(res, result);
});

export const createPatient = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const { duplicateMobileAcknowledged, ...patientInput } =
    req.body as CreatePatientInput & { duplicateMobileAcknowledged?: boolean };
  const patient = await createPatientService(userId, patientInput, {
    duplicateMobileAcknowledged: duplicateMobileAcknowledged === true,
  });

  return res.status(201).json({
    success: true,
    message: "Patient created successfully",
    data: { patient },
  });
});

export const getPatient = asyncHandler(async (req: Request, res: Response) => {
  const patient = await getPatientService(req.params.id);
  return sendSuccess(res, { patient });
});

export const updatePatient = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const patient = await updatePatientService(
    userId,
    req.params.id,
    req.body as UpdatePatientInput,
  );

  return sendSuccess(res, { patient });
});

export const deletePatient = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const result = await deletePatientService(userId, req.params.id);

  const { bills, payments, samples, results } = result.deleted;
  return res.status(200).json({
    success: true,
    message: `${result.patientId} (${result.fullName}) and all associated laboratory records were deleted`,
    data: {
      patientId: result.patientId,
      fullName: result.fullName,
      deleted: result.deleted,
      remaining: result.remaining,
      summary: `Removed ${bills} bill(s), ${payments} payment(s), ${samples} sample(s) and ${results} result(s).`,
    },
  });
});