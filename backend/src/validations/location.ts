import { z } from "zod";
import { LOCATION_LEVEL_ORDER, type LocationLevel } from "../constants/master-data";

export const LOCATION_LEVELS: LocationLevel[] = [...LOCATION_LEVEL_ORDER];

const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Invalid location ID")
  .optional();

const baseLocationSchema = z
  .object({
    type: z.enum(LOCATION_LEVELS as [LocationLevel, ...LocationLevel[]]),
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(120, "Name is too long"),
    parentId: objectIdSchema.nullable().optional(),
    active: z.boolean().default(true).optional(),
  })
  .strict();

export const createLocationSchema = baseLocationSchema;
export const updateLocationSchema = baseLocationSchema.partial();

export const listLocationsQuerySchema = z.object({
  type: z.enum(LOCATION_LEVELS as [LocationLevel, ...LocationLevel[]]).optional(),
  parentId: objectIdSchema.nullable().optional(),
  search: z.string().trim().max(120).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export type LocationFormData = z.infer<typeof createLocationSchema>;