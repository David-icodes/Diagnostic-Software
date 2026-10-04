import { z } from "zod";
import { isValidObjectId } from "../../../utils/object-id";
import { DATE_ONLY_REGEX, splitCsv } from "../utils/report-core";

const optionalIds = z.optional(
  z
    .string()
    .transform(splitCsv)
    .pipe(z.array(z.string().refine(isValidObjectId, "Invalid ID"))),
);

export const clientGeneratedLabBillsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    export: z.enum(["1"]).optional(),
    fromDate: z.string().regex(DATE_ONLY_REGEX, "Invalid fromDate (expected YYYY-MM-DD)").optional(),
    toDate: z.string().regex(DATE_ONLY_REGEX, "Invalid toDate (expected YYYY-MM-DD)").optional(),
    clientIds: optionalIds,
    referringDoctorId: z.string().refine(isValidObjectId, "Invalid referring doctor ID").optional(),
    orderBy: z.enum(["date_asc", "date_desc"]).default("date_desc"),
  })
  .strict();

export type ClientGeneratedLabBillsQuery = z.infer<
  typeof clientGeneratedLabBillsQuerySchema
>;