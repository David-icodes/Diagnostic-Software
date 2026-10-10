import { z } from "zod";
import { DOCTOR_TYPES, type DoctorType } from "../constants/master-data";

const MOBILE_REGEX = /^[6-9]\d{9}$/;
const DOCTOR_TYPE_OPTIONS = DOCTOR_TYPES as unknown as [DoctorType, ...DoctorType[]];
const optionalTrimmed = (max: number) =>
  z.string().trim().max(max).or(z.literal("")).optional().transform((value) => value || undefined);
const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid reference ID").optional();
const optionalFee = z.number().finite("Enter a valid amount").min(0, "Amount cannot be negative").optional();

interface NameCandidate {
  name?: string;
  firstName?: string;
  lastName?: string;
}

function fullNameIssue(ctx: z.RefinementCtx, message: string, path: string) {
  ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: [path] });
}

function requireFullName(value: NameCandidate, ctx: z.RefinementCtx) {
  if (value.name) return;
  if (!value.firstName || !value.lastName) {
    fullNameIssue(ctx, "First name and last name are required", "firstName");
  }
}

function requireFullNameWhenPartial(value: NameCandidate, ctx: z.RefinementCtx) {
  if (value.name) return;
  const hasAny = Boolean(value.firstName || value.lastName);
  if (hasAny && (!value.firstName || !value.lastName)) {
    fullNameIssue(ctx, "First name and last name are required together", "firstName");
  }
}

const baseDoctorSchema = z
  .object({
    // Legacy quick-create fields used by the billing doctor picker.
    name: optionalTrimmed(200),
    qualification: optionalTrimmed(100),
    specialization: optionalTrimmed(200),
    mobile: z
      .string()
      .regex(MOBILE_REGEX, "Enter a valid 10-digit mobile number")
      .or(z.literal(""))
      .optional()
      .transform((value) => value || undefined),
    // Full registration fields.
    employeeId: optionalTrimmed(50),
    firstName: optionalTrimmed(100),
    lastName: optionalTrimmed(100),
    middleName: optionalTrimmed(100),
    shortName: optionalTrimmed(60),
    gender: z.enum(["Male", "Female", "Other"]).optional(),
    email: z.string().trim().email("Enter a valid email").max(160).or(z.literal("")).optional().transform((value) => value || undefined),
    phone: optionalTrimmed(20),
    city: optionalTrimmed(120),
    specialisationId: objectId,
    designationId: objectId,
    departmentId: objectId,
    doctorType: z.enum(DOCTOR_TYPE_OPTIONS).optional(),
    onlineAppDisplay: z.enum(["Y", "N"]).default("Y").optional(),
    address: optionalTrimmed(500),
    roomNumber: optionalTrimmed(40),
    opConsultationFee: optionalFee,
    ipConsultationFee: optionalFee,
    hospitalFee: optionalFee,
    erConsultationFee: optionalFee,
    maxFreeVisits: z.number().int("Must be a whole number").min(0, "Cannot be negative").optional(),
    maxFreeDaysVisits: z.number().int("Must be a whole number").min(0, "Cannot be negative").optional(),
    active: z.boolean().default(true).optional(),
  })
  .strict();

export const createDoctorSchema = baseDoctorSchema.superRefine(requireFullName);
export const updateDoctorSchema = baseDoctorSchema.partial().superRefine(requireFullNameWhenPartial);

export type DoctorFormData = z.infer<typeof createDoctorSchema>;