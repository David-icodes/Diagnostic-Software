import { z } from "zod";
import { isValidObjectId } from "../utils/object-id";
import {
  LAB_TEST_RESULT_MODES,
  type LabTestResultMode,
} from "../models/lab-test.model";

export const createLabTestSchema = z
  .object({
    testCode: z
      .string()
      .trim()
      .min(2, "Test code must be at least 2 characters")
      .max(20, "Test code is too long")
      .transform((value) => value.toUpperCase()),
    testName: z.string().trim().min(3, "Test name must be at least 3 characters").max(150, "Test name is too long"),
    shortName: z.string().trim().min(1, "Short name is required").max(50, "Short name is too long"),
    departmentId: z
      .string()
      .refine(isValidObjectId, "Invalid department ID"),
    description: z
      .string()
      .trim()
      .max(1000, "Description is too long")
      .or(z.literal(""))
      .optional()
      .transform((value) => value || undefined),
    sampleType: z
      .string()
      .trim()
      .max(50, "Sample type is too long")
      .or(z.literal(""))
      .optional()
      .transform((value) => value || undefined),
    containerType: z
      .string()
      .trim()
      .max(50, "Container type is too long")
      .or(z.literal(""))
      .optional()
      .transform((value) => value || undefined),
    testType: z
      .string()
      .trim()
      .max(50, "Test type is too long")
      .or(z.literal(""))
      .optional()
      .transform((value) => value || undefined),
    price: z.number().finite().min(0, "Price cannot be negative").max(9_999_999, "Price is too large"),
    priceIp: z
      .number()
      .finite()
      .min(0, "IP price cannot be negative")
      .max(9_999_999, "IP price is too large")
      .optional(),
    priceInsIp: z
      .number()
      .finite()
      .min(0, "Insurance IP price cannot be negative")
      .max(9_999_999, "Insurance IP price is too large")
      .optional(),
    priceEr: z
      .number()
      .finite()
      .min(0, "ER price cannot be negative")
      .max(9_999_999, "ER price is too large")
      .optional(),
    doctorPrice: z
      .number()
      .finite()
      .min(0, "Doctor price cannot be negative")
      .max(9_999_999, "Doctor price is too large")
      .optional(),
    cghsCode: z
      .string()
      .trim()
      .max(30, "CGHS code is too long")
      .or(z.literal(""))
      .optional()
      .transform((value) => value?.trim() || undefined),
    nimsCode: z
      .string()
      .trim()
      .max(30, "NIMS code is too long")
      .or(z.literal(""))
      .optional()
      .transform((value) => value?.trim() || undefined),
    railwayCode: z
      .string()
      .trim()
      .max(30, "Railway code is too long")
      .or(z.literal(""))
      .optional()
      .transform((value) => value?.trim() || undefined),
    nfcCode: z
      .string()
      .trim()
      .max(30, "NFC code is too long")
      .or(z.literal(""))
      .optional()
      .transform((value) => value?.trim() || undefined),
    comments: z
      .string()
      .trim()
      .max(1000, "Comments are too long")
      .or(z.literal(""))
      .optional()
      .transform((value) => value?.trim() || undefined),
    referralPercent: z
      .number()
      .finite()
      .min(0, "Referral percent cannot be negative")
      .max(100, "Referral percent cannot exceed 100")
      .optional(),
    reportNote1: z
      .string()
      .trim()
      .max(500, "Report note is too long")
      .or(z.literal(""))
      .optional()
      .transform((value) => value?.trim() || undefined),
    reportNote2: z
      .string()
      .trim()
      .max(500, "Report note is too long")
      .or(z.literal(""))
      .optional()
      .transform((value) => value?.trim() || undefined),
    active: z.boolean().default(true).optional(),
    resultMode: z
      .enum(LAB_TEST_RESULT_MODES as unknown as [LabTestResultMode, ...LabTestResultMode[]])
      .default("SIMPLE_RESULT")
      .optional(),
  })
  .strict();

export const updateLabTestSchema = createLabTestSchema.partial();

export type LabTestFormData = z.infer<typeof createLabTestSchema>;