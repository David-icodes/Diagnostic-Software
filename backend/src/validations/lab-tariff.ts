import { z } from "zod";

const money = z
  .number()
  .finite()
  .min(0, "Price cannot be negative")
  .max(9_999_999, "Price is too large");

export const tariffRowSchema = z
  .object({
    testId: z.string().min(1, "Test ID is required"),
    price: money,
    priceIp: money.optional(),
    priceInsIp: money.optional(),
    priceEr: money.optional(),
  })
  .strict();

export const bulkLabTariffSchema = z
  .object({
    rows: z
      .array(tariffRowSchema)
      .min(1, "Select at least one test")
      .max(500, "Too many rows in one save")
      .refine((rows) => new Set(rows.map((row) => row.testId)).size === rows.length, "Duplicate tests in tariff update"),
  })
  .strict();

export type BulkLabTariffInput = z.infer<typeof bulkLabTariffSchema>;
