import { z } from "zod";

export const updateSampleOutsideSchema = z.object({
  out: z.boolean(),
  outsideLabId: z.string().regex(/^[a-f\d]{24}$/i, "Select a valid outside lab").nullable().optional(),
}).strict().superRefine((value, ctx) => {
  if (value.out && !value.outsideLabId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["outsideLabId"], message: "Select an outside lab" });
  if (!value.out && value.outsideLabId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["outsideLabId"], message: "Clear the outside lab when OUT is unchecked" });
});
export type UpdateSampleOutsideInput = z.infer<typeof updateSampleOutsideSchema>;
