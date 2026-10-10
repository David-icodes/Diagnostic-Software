import { z } from "zod";
import { PACKAGE_TYPES, type PackageType } from "../constants/master-data";

const OBJECT_ID = /^[a-f\d]{24}$/i;
const PACKAGE_TYPE_OPTIONS = PACKAGE_TYPES as unknown as [PackageType, ...PackageType[]];

const packageItemSchema = z.object({
  testId: z.string().regex(OBJECT_ID, "Invalid test reference").max(24),
  departmentId: z.string().regex(OBJECT_ID, "Invalid department reference").max(24),
});

const basePackageSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Package name must be at least 2 characters")
      .max(150, "Package name is too long"),
    packageType: z.enum(PACKAGE_TYPE_OPTIONS).default("Lab"),
    amount: z.number().finite("Enter a valid amount").min(0, "Amount cannot be negative"),
    insAmount: z
      .number()
      .finite("Enter a valid amount")
      .min(0, "Amount cannot be negative")
      .optional(),
    active: z.boolean().default(true).optional(),
    items: z.array(packageItemSchema).max(500, "Too many tests selected").default([]),
  })
  .strict();

function assertUniqueItems(
  value: { items?: { testId: string }[] },
  ctx: z.RefinementCtx,
) {
  const items = value.items ?? [];
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.testId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A lab test can only be selected once",
        path: ["items"],
      });
      break;
    }
    seen.add(item.testId);
  }
}

export const createPackageSchema = basePackageSchema.superRefine(assertUniqueItems);
export const updatePackageSchema = basePackageSchema.partial().superRefine(assertUniqueItems);

export type PackageFormData = z.infer<typeof createPackageSchema>;