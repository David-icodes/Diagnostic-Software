import { z } from "zod";

const id = z.string().regex(/^[a-f\d]{24}$/i, "Invalid entity ID");
export const reviewLisMessageSchema = z.object({
  patientId: id, billId: id,
  workflow: z.enum(["parameter-results", "lab-reprint"]).optional(),
  templateName: z.enum(["lab_report_ready", "lab_invoice_ready", "patient_thank_you"]),
  testIds: z.array(id).max(100).default([]),
  technicianId: id.optional(),
  includeHeader: z.boolean().optional(),
  onlyEntered: z.boolean().default(false),
  printMode: z.enum(["continuous", "department", "test"]).default("continuous"),
}).strict().superRefine((input,context)=>{
 if(input.workflow==="lab-reprint"&&input.templateName!=="lab_invoice_ready"||input.workflow==="parameter-results"&&input.templateName!=="lab_report_ready")context.addIssue({code:"custom",message:"Choose the template for this workflow: invoices for Lab Reprint, reports for Parameter Results.",path:["templateName"]});
});
export type ReviewLisMessageInput = z.infer<typeof reviewLisMessageSchema>;
export const lisReviewIdSchema = z.object({ reviewId: z.string().uuid() }).strict();
