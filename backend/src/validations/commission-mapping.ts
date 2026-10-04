import { z } from "zod";

const money = z.number().finite().min(0).max(99_999_999, "Amount is too large");
const percent = z
  .number()
  .finite()
  .min(0, "Commission percent cannot be negative")
  .max(100, "Commission percent cannot exceed 100");

export const commissionMappingRowSchema = z
  .object({
    testId: z.string().min(1, "Test ID is required"),
    commissionPercent: percent.optional(),
    commissionAmount: money.optional(),
  })
  .strict();

export const assignCommissionMappingsSchema = z
  .object({
    doctorId: z.string().min(1, "Doctor ID is required"),
    departmentId: z.string().min(1, "Department ID is required"),
    /** Explicit consent to replace existing mappings. Required when any exist. */
    overwrite: z.boolean().default(false).optional(),
    mappings: z
      .array(commissionMappingRowSchema)
      .min(1, "Select at least one test with a commission value")
      .max(500, "Too many rows in one save"),
  })
  .strict()
  .superRefine((value, ctx) => {
    const invalid = value.mappings.filter(
      (row) =>
        row.commissionPercent === undefined &&
        row.commissionAmount === undefined,
    );
    if (invalid.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["mappings"],
        message:
          "Every selected test needs a commission percent or a rupee amount",
      });
    }
  });

export type AssignCommissionMappingsInput = z.infer<
  typeof assignCommissionMappingsSchema
>;