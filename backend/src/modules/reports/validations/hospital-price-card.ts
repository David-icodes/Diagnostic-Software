import { z } from "zod";
import { isValidObjectId } from "../../../utils/object-id";

export const hospitalPriceCardQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    export: z.literal("1").optional(),
    serviceType: z.string().trim().max(60).default("lab-test"),
    departmentId: z.string().refine(isValidObjectId, "Invalid department ID").optional(),
    labName: z.string().trim().max(120).optional(),
    status: z.enum(["active", "inactive", "all"]).default("active"),
  })
  .strict();

export type HospitalPriceCardQuery = z.infer<typeof hospitalPriceCardQuerySchema>;