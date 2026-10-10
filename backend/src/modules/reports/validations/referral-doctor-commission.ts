import { z } from "zod";
import { isValidObjectId } from "../../../utils/object-id";
import { DATE_ONLY_REGEX, splitCsv } from "../utils/report-core";

const optionalIds = z.optional(
  z
    .string()
    .transform(splitCsv)
    .pipe(z.array(z.string().refine(isValidObjectId, "Invalid ID"))),
);

export const referralDoctorCommissionQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    export: z.enum(["1"]).optional(),
    fromDate: z.string().regex(DATE_ONLY_REGEX, "Invalid fromDate (expected YYYY-MM-DD)").optional(),
    toDate: z.string().regex(DATE_ONLY_REGEX, "Invalid toDate (expected YYYY-MM-DD)").optional(),
    doctorIds: optionalIds,
    departmentIds: optionalIds,
    testIds: optionalIds,
    patientId: z.string().trim().max(60).optional(),
    patientTypes: z.optional(
      z
        .string()
        .transform(splitCsv)
        .pipe(z.array(z.enum(["gp", "op", "ip"]))),
    ),
    commissionBasis: z.enum(["referral", "cons_op_ip"]).default("referral"),
    amountBasis: z.enum(["net", "paid"]).default("net"),
    claimType: z.enum(["all"]).default("all"),
  })
  .strict();

export type ReferralDoctorCommissionQuery = z.infer<
  typeof referralDoctorCommissionQuerySchema
>;