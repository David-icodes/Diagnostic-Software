import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/http";
import { requireUserId } from "../../utils/require-user-id";
import {
  createPackage as createService,
  getPackage as getService,
  listPackages as listService,
  setPackageActive as setActiveService,
  updatePackage as updateService,
} from "./package.service";
import type { CreatePackageInput, UpdatePackageInput } from "./package.service";

export const listPackages = asyncHandler(async (req: Request, res: Response) => {
  const result = await listService({
    page: typeof req.query.page === "string" ? Number(req.query.page) : undefined,
    limit: typeof req.query.limit === "string" ? Number(req.query.limit) : undefined,
    search: typeof req.query.search === "string" ? req.query.search : undefined,
    status: typeof req.query.status === "string" ? req.query.status : undefined,
  });
  return sendSuccess(res, result);
});

export const getPackage = asyncHandler(async (req: Request, res: Response) => {
  const pkg = await getService(req.params.id);
  return sendSuccess(res, { package: pkg });
});

export const createPackage = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const pkg = await createService(userId, req.body as CreatePackageInput);
  return res.status(201).json({
    success: true,
    message: "Package created successfully",
    data: { package: pkg },
  });
});

export const updatePackage = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const pkg = await updateService(req.params.id, userId, req.body as UpdatePackageInput);
  return sendSuccess(res, { package: pkg });
});

export const activatePackage = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const pkg = await setActiveService(req.params.id, userId, true);
  return sendSuccess(res, { package: pkg });
});

export const deactivatePackage = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const pkg = await setActiveService(req.params.id, userId, false);
  return sendSuccess(res, { package: pkg });
});