import { z } from "zod";
import { DEPARTMENT_TYPES, type DepartmentType } from "../constants/master-data";

const DEPARTMENT_TYPE_OPTIONS = DEPARTMENT_TYPES as unknown as [
  DepartmentType,
  ...DepartmentType[],
];

const baseDepartmentSchema = z
  .object({
    name: z.string().trim().min(2, "Department name must be at least 2 characters").max(100, "Department name is too long"),
    code: z
      .string()
      .trim()
      .min(2, "Short name must be at least 2 characters")
      .max(10, "Short name is too long")
      .transform((value) => value.toUpperCase()),
    description: z
      .string()
      .trim()
      .max(500, "Description is too long")
      .or(z.literal(""))
      .optional()
      .transform((value) => value || undefined),
    type: z.enum(DEPARTMENT_TYPE_OPTIONS).optional(),
    active: z.boolean().default(true).optional(),
    sortOrder: z
      .number()
      .int("Sort order must be a whole number")
      .min(0, "Sort order cannot be negative")
      .max(9999, "Sort order is too large")
      .optional(),
  })
  .strict();

export const createDepartmentSchema = baseDepartmentSchema;
export const updateDepartmentSchema = baseDepartmentSchema.partial();

export type DepartmentFormData = z.infer<typeof createDepartmentSchema>;