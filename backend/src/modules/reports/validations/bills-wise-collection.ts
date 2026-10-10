import { z } from "zod";

export const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const REPORT_PATIENT_TYPE_VALUES = ["gp", "op", "ip", "er"] as const;

export const billsWiseCollectionQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    export: z.literal("1").optional(),
    fromDate: z
      .string()
      .regex(DATE_ONLY_REGEX, "Invalid fromDate (expected YYYY-MM-DD)")
      .optional(),
    toDate: z
      .string()
      .regex(DATE_ONLY_REGEX, "Invalid toDate (expected YYYY-MM-DD)")
      .optional(),
    patientId: z.string().trim().max(60).optional(),
    billType: z.string().optional(),
    collectedBy: z.string().optional(),
    payMode: z.string().optional(),
    orderBy: z.enum(["date_asc", "date_desc"]).default("date_desc"),
    withCancelled: z.literal("1").optional(),
    patientTypes: z.string().optional(),
  })
  .strict();

export type BillsWiseCollectionQuery = z.infer<typeof billsWiseCollectionQuerySchema>;