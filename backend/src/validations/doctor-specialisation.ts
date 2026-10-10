import { z } from "zod";

const baseSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(120, "Name is too long"),
    active: z.boolean().default(true).optional(),
  })
  .strict();

export const createDoctorSpecialisationSchema = baseSchema;
export const updateDoctorSpecialisationSchema = baseSchema.partial();

export type DoctorSpecialisationFormData = z.infer<typeof createDoctorSpecialisationSchema>;