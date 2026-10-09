import { z } from "zod";

const id = z.string().regex(/^[a-f\d]{24}$/i, "Invalid entity ID");
export const reviewLisMessageSchema = z.object({
  patientId: id, billId: id,
  workflow: z.enum(["parameter-results", "lab-reprint"]).optional(),
  templateName: z.enum(["lab_report_ready", "lab_invoice_ready", "patient_thank_you"]),
  testIds: z.array(id).max(100).default([]),
  technicianId: id.optional(),
  onlyEntered: z.boolean().default(false),
  printMode: z.enum(["continuous", "department", "test"]).default("continuous"),
}).strict();
export type ReviewLisMessageInput = z.infer<typeof reviewLisMessageSchema>;
export const lisReviewIdSchema = z.object({ reviewId: z.string().uuid() }).strict();
