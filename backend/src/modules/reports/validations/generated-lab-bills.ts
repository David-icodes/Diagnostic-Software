import { z } from "zod";
import { isValidObjectId } from "../../../utils/object-id";
import { PATIENT_TYPES, PAYMENT_MODES } from "../../../models/lab-bill.model";

export const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const generatedLabBillsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    fromDate: z.string().regex(DATE_ONLY_REGEX, "Invalid fromDate (expected YYYY-MM-DD)").optional(),
    toDate: z.string().regex(DATE_ONLY_REGEX, "Invalid toDate (expected YYYY-MM-DD)").optional(),
    patientId: z.string().trim().max(60).optional(),
    patientName: z.string().trim().max(120).optional(),
    billNumber: z.string().trim().max(60).optional(),
    patientType: z.enum(PATIENT_TYPES as [string, ...string[]]).optional(),
    departmentId: z.string().refine(isValidObjectId, "Invalid department ID").optional(),
    referringDoctorId: z.string().refine(isValidObjectId, "Invalid referring doctor ID").optional(),
    paymentStatus: z.enum(["paid", "partial", "unpaid"]).optional(),
    /** Comma-separated patient types, used by the multi-select filter group. */
    patientTypes: z.string().trim().optional(),
    /** Comma-separated stored payment modes. */
    paymentModes: z
      .string()
      .trim()
      .refine(
        (value) =>
          value
            .split(",")
            .every((mode) =>
              (PAYMENT_MODES as string[]).includes(mode.trim()),
            ),
        "Invalid payment mode",
      )
      .optional(),
    /** Comma-separated doctor ids for the searchable doctor filter. */
    referringDoctorIds: z.string().trim().optional(),
    /** Comma-separated user ids who collected the bills. */
    collectedByIds: z.string().trim().optional(),
    /** `date_desc` (default) or `date_asc`. */
    orderBy: z.enum(["date_desc", "date_asc"]).optional(),
    /** `"1"` restricts the report to bills that carry a discount. */
    discountedOnly: z.enum(["1"]).optional(),
  })
  .strict();

export type GeneratedLabBillsQuery = z.infer<typeof generatedLabBillsQuerySchema>;