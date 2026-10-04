import { z } from "zod";
import { isValidObjectId } from "../utils/object-id";
import {
  PAYMENT_MODES,
  PATIENT_TYPES,
  BILL_CREATION_STATUSES,
  BILL_TYPES,
} from "../models/lab-bill.model";

const itemSchema = z
  .object({
    testId: z.string().refine(isValidObjectId, "Invalid test ID"),
    quantity: z.number().int("Quantity must be a whole number").min(1, "Quantity must be at least 1").max(100, "Quantity is too large"),
  })
  .strict();

const billingInputSchema = z
  .object({
    patientId: z.string().refine(isValidObjectId, "Invalid patient ID"),
    patientType: z.enum(PATIENT_TYPES as [string, ...string[]]).default("osp").optional(),
    referringDoctorId: z
      .string()
      .refine(isValidObjectId, "Invalid doctor ID")
      .or(z.literal(""))
      .or(z.null())
      .optional()
      .transform((value) => value || undefined),
    items: z.array(itemSchema).min(1, "At least one test is required").max(100, "Too many tests"),
    discountPercent: z.number().finite().min(0, "Discount cannot be negative").max(100, "Discount cannot exceed 100%").default(0).optional(),
    discountAmount: z.number().finite().min(0, "Discount amount cannot be negative").optional(),
    paymentMode: z.enum(PAYMENT_MODES as [string, ...string[]]).default("cash").optional(),
    comments: z
      .string()
      .trim()
      .max(500, "Comments are too long")
      .or(z.literal(""))
      .optional()
      .transform((value) => value || undefined),
    displayComments: z
      .string()
      .trim()
      .max(500, "Display comments are too long")
      .or(z.literal(""))
      .optional()
      .transform((value) => value || undefined),
  })
  .strict();

export const createLabBillSchema = billingInputSchema
  .extend({
    billType: z.enum(BILL_TYPES as [string, ...string[]]).default("osp").optional(),
    clientId: z
      .string()
      .refine(isValidObjectId, "Invalid client ID")
      .or(z.literal(""))
      .or(z.null())
      .optional()
      .transform((value) => value || undefined),
    paidAmount: z.number().finite().min(0, "Paid amount cannot be negative").default(0).optional(),
    status: z.enum([...BILL_CREATION_STATUSES] as [string, ...string[]]).default("draft").optional(),
  })
  .strict();

export type CreateLabBillInput = z.infer<typeof createLabBillSchema>;

/**
 * Modification is intentionally restricted: only the billing contents that
 * can be safely re-computed server-side (items, discount, payment meta).
 * Patient, bill number and status changes are not supported.
 */
export const modifyLabBillSchema = billingInputSchema
  .omit({ patientId: true, patientType: true })
  .strict();

export type ModifyLabBillInput = z.infer<typeof modifyLabBillSchema>;

export const cancelLabBillSchema = z
  .object({
    cancellationRemarks: z
      .string()
      .trim()
      .min(3, "Cancellation remarks are required (minimum 3 characters)")
      .max(500, "Cancellation remarks are too long"),
  })
  .strict();

export type CancelLabBillInput = z.infer<typeof cancelLabBillSchema>;

export const collectLabDueSchema = z
  .object({
    amount: z
      .number()
      .finite("Amount must be a finite number")
      .positive("Amount to collect must be greater than 0")
      .max(100_000_000, "Amount is too large"),
    discountAmount: z
      .number()
      .finite("Discount must be a finite number")
      .min(0, "Discount cannot be negative")
      .max(100_000_000, "Discount is too large")
      .default(0)
      .optional(),
    paymentMode: z.enum(PAYMENT_MODES as [string, ...string[]]),
    comments: z
      .string()
      .trim()
      .max(500, "Comments are too long")
      .or(z.literal(""))
      .optional()
      .transform((value) => value || undefined),
  })
  .strict();

export type CollectLabDueInput = z.infer<typeof collectLabDueSchema>;