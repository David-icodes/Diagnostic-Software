import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/http";
import { requireUserId } from "../../utils/require-user-id";
import { ApiError } from "../../utils/api-error";
import {
  createLocation as createService,
  getLocation as getService,
  listLocations as listService,
  setLocationActive as setActiveService,
  updateLocation as updateService,
} from "./location.service";
import type { CreateLocationInput, UpdateLocationInput } from "./location.service";

export const listLocations = asyncHandler(async (req: Request, res: Response) => {
  const type = typeof req.query.type === "string" ? req.query.type : undefined;
  const parentId =
    typeof req.query.parentId === "string" ? req.query.parentId : undefined;
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const status = typeof req.query.status === "string" ? req.query.status : undefined;

  if (type && req.query.parentId === undefined && type !== "country") {
    throw new ApiError(400, "A parent location is required for this level");
  }

  const locations = await listService({ type, parentId, search, status });
  return sendSuccess(res, locations);
});

export const getLocation = asyncHandler(async (req: Request, res: Response) => {
  const location = await getService(req.params.id);
  return sendSuccess(res, { location });
});

export const createLocation = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const location = await createService(userId, req.body as CreateLocationInput);
  return res.status(201).json({
    success: true,
    message: "Location created successfully",
    data: { location },
  });
});

export const updateLocation = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const location = await updateService(req.params.id, userId, req.body as UpdateLocationInput);
  return sendSuccess(res, { location });
});

export const activateLocation = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const location = await setActiveService(req.params.id, userId, true);
  return sendSuccess(res, { location });
});

export const deactivateLocation = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const location = await setActiveService(req.params.id, userId, false);
  return sendSuccess(res, { location });
});