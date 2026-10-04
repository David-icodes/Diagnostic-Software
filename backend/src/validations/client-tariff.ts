import { z } from "zod";

const money = z
  .number()
  .finite()
  .min(0, "Price cannot be negative")
  .max(9_999_999, "Price is too large");

export const applyClientTariffSchema = z
  .object({
    clientId: z.string().min(1, "Client ID is required"),
    departmentId: z.string().min(1, "Department ID is required"),
    /** Explicit consent to replace existing client tariffs. Required when any exist. */
    overwrite: z.boolean().default(false).optional(),
    rows: z
      .array(
        z
          .object({
            testId: z.string().min(1, "Test ID is required"),
            price: money,
          })
          .strict(),
      )
      .min(1, "Select at least one test")
      .max(500, "Too many rows in one save"),
  })
  .strict();

export type ApplyClientTariffInput = z.infer<typeof applyClientTariffSchema>;