import { z } from "zod";
import { GENDERS, BLOOD_GROUPS } from "@/types/patient";

const DATE_INPUT_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MOBILE_REGEX = /^[6-9]\d{9}$/;
const PINCODE_REGEX = /^\d{6}$/;

const optionalText = (max: number) =>
  z.union([z.string().trim().max(max), z.literal("")]).optional();

const dateOfBirthField = z
  .union([
    z.string().regex(DATE_INPUT_REGEX, "Enter a valid date (YYYY-MM-DD)"),
    z.literal(""),
  ])
  .superRefine((value, ctx) => {
    if (!value) return;
    // Local calendar day, not the UTC day: a date-only value must not be judged
    // "in the future" before the local UTC offset has elapsed.
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    if (value > today) {
      ctx.addIssue({
        code: "custom",
        message: "Date of birth cannot be in the future",
      });
    }
  });

/**
 * NOTE: the schema deliberately keeps `z.input` identical to `z.output`
 * (no value-condensing transforms) so React Hook Form's resolver types line
 * up exactly. Optional fields may be empty strings, which the backend
 * validation normalises to `undefined`.
 */
export const patientFormSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(2, "First name must be at least 2 characters")
      .max(60, "First name is too long"),
    lastName: optionalText(60),
    gender: z.enum(GENDERS, { message: "Gender is required" }),
    dateOfBirth: dateOfBirthField,
    age: z
      .union([
        z
          .number()
          .int("Age must be a whole number")
          .min(0, "Age must be between 0 and 150")
          .max(150, "Age must be between 0 and 150"),
        z.nan(),
      ])
      .transform((value) => (Number.isNaN(value) ? undefined : value))
      .optional(),
    mobile: z.string().regex(MOBILE_REGEX, "Enter a valid 10-digit mobile number"),
    email: z
      .union([z.email("Enter a valid email address"), z.literal("")])
      .optional(),
    address: optionalText(500),
    city: optionalText(100),
    state: optionalText(100),
    pincode: z
      .union([z.string().regex(PINCODE_REGEX, "Pincode must be 6 digits"), z.literal("")])
      .optional(),
    emergencyContact: z
      .union([
        z.string().regex(MOBILE_REGEX, "Enter a valid 10-digit mobile number"),
        z.literal(""),
      ])
      .optional(),
    bloodGroup: z.union([z.enum(BLOOD_GROUPS), z.literal("")]).optional(),
    status: z.enum(["active", "inactive"]).optional(),
  })
  .strict();

export type PatientFormValues = z.infer<typeof patientFormSchema>;

export function toFormValues(
  patient: PatientFormValues | undefined | null,
): PatientFormValues {
  return {
    firstName: patient?.firstName ?? "",
    lastName: patient?.lastName ?? "",
    gender: patient?.gender ?? "male",
    dateOfBirth: patient?.dateOfBirth ?? "",
    age: patient?.age,
    mobile: patient?.mobile ?? "",
    email: patient?.email ?? "",
    address: patient?.address ?? "",
    city: patient?.city ?? "",
    state: patient?.state ?? "",
    pincode: patient?.pincode ?? "",
    emergencyContact: patient?.emergencyContact ?? "",
    bloodGroup: patient?.bloodGroup ?? "",
    status: patient?.status ?? "active",
  };
}