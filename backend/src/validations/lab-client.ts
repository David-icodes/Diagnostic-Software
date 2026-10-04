import { z } from "zod";

const MOBILE_REGEX = /^[6-9]\d{9}$/;
const optionalTrimmed = (max: number) =>
  z.string().trim().max(max).or(z.literal("")).optional().transform((value) => value || undefined);

const baseClientSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Client name must be at least 2 characters")
      .max(120, "Client name is too long"),
    contactPerson: optionalTrimmed(120),
    mobile: z
      .string()
      .regex(MOBILE_REGEX, "Enter a valid 10-digit mobile number")
      .or(z.literal(""))
      .optional()
      .transform((value) => value || undefined),
    phone: optionalTrimmed(20),
    email: z.string().trim().email("Enter a valid email").max(120).or(z.literal("")).optional().transform((value) => value || undefined),
    address: optionalTrimmed(500),
    city: optionalTrimmed(100),
    active: z.boolean().default(true).optional(),
  })
  .strict();

export const createClientSchema = baseClientSchema;
export const updateClientSchema = baseClientSchema.partial();

export type CreateClientInput = z.infer<typeof createClientSchema>;