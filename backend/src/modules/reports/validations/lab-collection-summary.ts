import { z } from "zod";
import { DATE_ONLY_REGEX } from "../utils/report-core";

export const labCollectionSummaryQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    export: z.enum(["1"]).optional(),
    fromDate: z.string().regex(DATE_ONLY_REGEX, "Invalid fromDate (expected YYYY-MM-DD)").optional(),
    toDate: z.string().regex(DATE_ONLY_REGEX, "Invalid toDate (expected YYYY-MM-DD)").optional(),
  })
  .strict();

export type LabCollectionSummaryQuery = z.infer<typeof labCollectionSummaryQuerySchema>;