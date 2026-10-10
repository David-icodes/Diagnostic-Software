import { z } from "zod";

export const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const cancelledBillsQuerySchema = z
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
    billType: z.string().optional(),
    payMode: z.string().optional(),
    cancelledBy: z.string().optional(),
    /** "summary" or "detailed" column sets. */
    mode: z.enum(["summary", "detailed"]).default("summary"),
  })
  .strict();

export type CancelledBillsQuery = z.infer<typeof cancelledBillsQuerySchema>;