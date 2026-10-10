import { z } from "zod";
import { isValidObjectId } from "../utils/object-id";
import {
  SAMPLE_STATUSES,
  type SampleStatus,
} from "../models/lab-sample.model";

export const TIME_24H_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export const updateSampleStatusSchema = z
  .object({
    status: z
      .enum(SAMPLE_STATUSES as [SampleStatus, ...SampleStatus[]])
      .refine((value) => value !== "SELECT", "Select a sample status to save"),
    time: z
      .string()
      .regex(TIME_24H_REGEX, "Time must be in 24-hour HH:MM format")
      .optional()
      .or(z.literal(""))
      .transform((value) => value || undefined),
    comments: z
      .string()
      .trim()
      .max(500, "Comments are too long")
      .or(z.literal(""))
      .optional()
      .transform((value) => value || undefined),
  })
  .strict();

export type UpdateSampleStatusInput = z.infer<typeof updateSampleStatusSchema>;

const resultEntrySchema = z
  .object({
    parameterId: z.string().refine(isValidObjectId, "Invalid parameter ID"),
    result: z.union([
      z.string().trim().min(1, "Result cannot be empty"),
      z.number().finite("Result must be a finite number"),
      z.boolean(),
    ]),
  })
  .strict();

export const submitResultsSchema = z
  .object({
    billId: z.string().refine(isValidObjectId, "Invalid bill ID"),
    testId: z.string().refine(isValidObjectId, "Invalid test ID"),
    entries: z.array(resultEntrySchema).min(1, "At least one result is required").max(200, "Too many results"),
  })
  .strict();

export type SubmitResultsInput = z.infer<typeof submitResultsSchema>;