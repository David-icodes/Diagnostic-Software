import { z } from "zod";
import {
  BLOOD_GROUPS,
  GENDERS,
  type PatientBloodGroup,
  type PatientGender,
} from "../models/patient.model";

const MOBILE_REGEX = /^[6-9]\d{9}$/;
const PINCODE_REGEX = /^\d{6}$/;

const optionalTrimmed = (max: number) =>
  z.string().trim().max(max).or(z.literal("")).optional().transform((value) => value || undefined);

const dateOfBirthSchema = z
  .string()
  .or(z.literal(""))
  .superRefine((value, ctx) => {
    if (!value) return;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a valid date of birth",
      });
      return;
    }
    if (date > new Date()) {
      ctx.addIssue({
        code: "custom",
        message: "Date of birth cannot be in the future",
      });
    }
  })
  .optional()
  .transform((value) => (value ? new Date(value) : undefined));

const basePatientSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(2, "First name must be at least 2 characters")
      .max(60, "First name is too long"),
    lastName: optionalTrimmed(60),
    gender: z.enum(GENDERS, { required_error: "Gender is required" }),
    dateOfBirth: dateOfBirthSchema,
    age: z
      .number()
      .int("Age must be a whole number")
      .min(0, "Age must be between 0 and 150")
      .max(150, "Age must be between 0 and 150")
      .optional(),
    mobile: z.string().regex(MOBILE_REGEX, "Enter a valid 10-digit mobile number"),
    email: z
      .string()
      .trim()
      .email("Enter a valid email address")
      .or(z.literal(""))
      .optional()
      .transform((value) => value || undefined),
    address: optionalTrimmed(500),
    city: optionalTrimmed(100),
    state: optionalTrimmed(100),
    pincode: z
      .string()
      .regex(PINCODE_REGEX, "Pincode must be 6 digits")
      .or(z.literal(""))
      .optional()
      .transform((value) => value || undefined),
    emergencyContact: z
      .string()
      .regex(MOBILE_REGEX, "Enter a valid 10-digit mobile number")
      .or(z.literal(""))
      .optional()
      .transform((value) => value || undefined),
    bloodGroup: z
      .enum(BLOOD_GROUPS)
      .or(z.literal(""))
      .optional()
      .transform((value) => value || undefined),
    status: z.enum(["active", "inactive"]).optional(),
  })
  .strict(); // Rejects unknown keys (e.g. patientId) so it can never be spoofed.

export const createPatientSchema = basePatientSchema.extend({
  /**
   * Explicit operator confirmation that a new registration is a different
   * person who shares an already-registered mobile number. Without it the
   * service answers with the matching record so the caller can reuse it.
   */
  duplicateMobileAcknowledged: z.boolean().optional(),
});

export const updatePatientSchema = basePatientSchema.partial();

export type PatientFormData = z.infer<typeof createPatientSchema> & {
  gender: PatientGender;
  bloodGroup?: PatientBloodGroup;
};