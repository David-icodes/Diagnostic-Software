import { Types, type FilterQuery } from "mongoose";
import { ApiError } from "../../utils/api-error";
import { Location, type ILocation, type LocationDoc } from "../../models/location.model";
import { LOCATION_LEVEL_ORDER, type LocationLevel } from "../../constants/master-data";

export type CreateLocationInput = Omit<
  ILocation,
  "createdBy" | "createdAt" | "updatedAt"
>;

export type UpdateLocationInput = Partial<
  Omit<ILocation, "createdBy" | "createdAt" | "updatedAt">
>;

export interface ListLocationsParams {
  type?: string;
  parentId?: string;
  search?: string;
  status?: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isDuplicateKeyError(error: unknown): boolean {
  return error instanceof Error && (error as { code?: number }).code === 11000;
}

function parentLevelFor(level: LocationLevel): LocationLevel | null {
  const index = LOCATION_LEVEL_ORDER.indexOf(level);
  if (index <= 0) return null;
  return LOCATION_LEVEL_ORDER[index - 1];
}

export async function listLocations({
  type,
  parentId,
  search,
  status,
}: ListLocationsParams = {}): Promise<LocationDoc[]> {
  const filter: FilterQuery<ILocation> = {};
  if (type && (LOCATION_LEVEL_ORDER as readonly string[]).includes(type)) {
    filter.type = type as LocationLevel;
  }
  if (typeof parentId === "string" && parentId.trim()) {
    if (!Types.ObjectId.isValid(parentId)) {
      throw new ApiError(400, "Invalid parent location ID");
    }
    filter.parentId = new Types.ObjectId(parentId);
  } else if (parentId === "" && (type === "country" || !type)) {
    filter.parentId = null;
  }
  if (status === "active" || status === "inactive") {
    filter.active = status === "active";
  }
  const keyword = search?.trim();
  if (keyword) {
    filter.name = { $regex: escapeRegExp(keyword), $options: "i" };
  }
  return Location.find(filter).sort({ name: 1 }).exec();
}

export async function getLocation(id: string): Promise<LocationDoc> {
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid location ID");
  }
  const location = await Location.findById(id).exec();
  if (!location) {
    throw new ApiError(404, "Location not found");
  }
  return location;
}

async function validateParent(
  level: LocationLevel,
  parentId: Types.ObjectId | string | null | undefined,
): Promise<void> {
  const requiredParentLevel = parentLevelFor(level);
  if (requiredParentLevel && !parentId) {
    throw new ApiError(
      400,
      `A ${requiredParentLevel} must be selected before creating a ${level}`,
    );
  }
  if (!requiredParentLevel && parentId) {
    throw new ApiError(400, "A country cannot have a parent location");
  }
  if (!parentId) return;

  const parent = await getLocation(String(parentId));
  if (parent.type !== requiredParentLevel) {
    throw new ApiError(
      400,
      `A ${level} must belong to a ${requiredParentLevel}, not a ${parent.type}`,
    );
  }
}

export async function createLocation(
  userId: string,
  input: CreateLocationInput,
): Promise<LocationDoc> {
  await validateParent(input.type, input.parentId ?? null);
  try {
    return await Location.create({
      ...input,
      parentId: input.parentId ?? null,
      active: input.active ?? true,
      createdBy: userId,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new ApiError(409, `This ${input.type} name already exists under the same parent`);
    }
    throw error;
  }
}

export async function updateLocation(
  id: string,
  userId: string,
  input: UpdateLocationInput,
): Promise<LocationDoc> {
  const location = await getLocation(id);
  const nextType = input.type ?? location.type;
  const nextParentId =
    input.parentId === null ? null : (input.parentId ?? location.parentId ?? null);
  await validateParent(nextType, nextParentId);
  try {
    const changes: Record<string, unknown> = { ...input, updatedBy: new Types.ObjectId(userId) };
    if (input.parentId !== undefined) {
      changes.parentId = nextParentId;
    }
    Object.assign(location, changes);
    await location.save();
    return location;
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new ApiError(409, `This ${nextType} name already exists under the same parent`);
    }
    throw error;
  }
}

export async function isLocationReferenced(id: string): Promise<boolean> {
  const count = await Location.countDocuments({ parentId: id }).exec();
  return count > 0;
}

export async function setLocationActive(
  id: string,
  userId: string,
  active: boolean,
): Promise<LocationDoc> {
  const location = await getLocation(id);
  if (!active && (await isLocationReferenced(id))) {
    throw new ApiError(
      409,
      "Cannot deactivate: this location has child locations under it",
    );
  }
  location.active = active;
  Object.assign(location, { updatedBy: new Types.ObjectId(userId) });
  await location.save();
  return location;
}