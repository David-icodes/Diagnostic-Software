import { z } from "zod";
import { PAYMENT_MODES } from "@/types/billing";

const numberField = z
  .union([
    z
      .number()
      .finite("Enter a valid number")
      .min(0, "Value cannot be negative")
      .max(100_000_000, "Value is too large"),
    z.nan(),
  ])
  .transform((value) => (Number.isNaN(value) ? 0 : value));

export const billingFormSchema = z
  .object({
    discountPercent: z
      .union([
        z
          .number()
          .finite("Enter a valid percentage")
          .min(0, "Discount cannot be negative")
          .max(100, "Discount cannot exceed 100%"),
        z.nan(),
      ])
      .transform((value) => (Number.isNaN(value) ? 0 : value)),
    paidAmount: numberField,
    paymentMode: z.enum(PAYMENT_MODES, { message: "Select a payment mode" }),
    comments: z
      .union([z.string().trim().max(500, "Comments are too long"), z.literal("")])
      .optional()
      .transform((value) => value || undefined),
    displayComments: z
      .union([z.string().trim().max(500, "Display comments are too long"), z.literal("")])
      .optional()
      .transform((value) => value || undefined),
  })
  .strict();

export type BillingFormValues = z.infer<typeof billingFormSchema>;
export type BillingFormInput = z.input<typeof billingFormSchema>;

export interface DoctorFormValues {
  name: string;
  qualification?: string;
  specialization?: string;
}

export function toBillingFormValues(
  values: Partial<BillingFormValues> = {},
): BillingFormValues {
  return {
    discountPercent: values.discountPercent ?? 0,
    paidAmount: values.paidAmount ?? 0,
    paymentMode: values.paymentMode ?? "cash",
    comments: values.comments ?? undefined,
    displayComments: values.displayComments ?? undefined,
  };
}