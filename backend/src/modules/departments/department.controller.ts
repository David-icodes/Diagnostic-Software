import { deleteDepartment as deleteDepartmentService } from "./department.service";
import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/http";
import { requireUserId } from "../../utils/require-user-id";
import {
  createDepartment as createDepartmentService,
  getDepartment as getDepartmentService,
  listDepartments as listDepartmentsService,
  setDepartmentActive as setDepartmentActiveService,
  updateDepartment as updateDepartmentService,
} from "./department.service";
import type {
  CreateDepartmentInput,
  UpdateDepartmentInput,
} from "./department.service";

export const listDepartments = asyncHandler(async (req: Request, res: Response) => {
  const departments = await listDepartmentsService({
    status: typeof req.query.status === "string" ? req.query.status : undefined,
    search: typeof req.query.search === "string" ? req.query.search : undefined,
  });
  return sendSuccess(res, departments);
});

export const getDepartment = asyncHandler(async (req: Request, res: Response) => {
  const department = await getDepartmentService(req.params.id);
  return sendSuccess(res, { department });
});

export const createDepartment = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const department = await createDepartmentService(
    userId,
    req.body as CreateDepartmentInput,
  );
  return res.status(201).json({
    success: true,
    message: "Department created successfully",
    data: { department },
  });
});

export const updateDepartment = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const department = await updateDepartmentService(
    userId,
    req.params.id,
    req.body as UpdateDepartmentInput,
  );
  return sendSuccess(res, { department });
});

export const activateDepartment = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const department = await setDepartmentActiveService(userId, req.params.id, true);
  return sendSuccess(res, { department });
});

export const deactivateDepartment = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const department = await setDepartmentActiveService(userId, req.params.id, false);
  return sendSuccess(res, { department });
});
export const deleteDepartment = asyncHandler(async (req: Request, res: Response) => {
  requireUserId(req);
  await deleteDepartmentService(req.params.id);
  return sendSuccess(res, { deleted: true });
});
