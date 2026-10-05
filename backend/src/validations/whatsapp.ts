import { z } from "zod";

/**
 * Body for the authenticated internal WhatsApp send test.
 *
 * `to` is validated loosely here (a plausible phone number); the service
 * normalises it to digits and enforces the E.164 length limit.
 */
export const sendTestTemplateSchema = z.object({
  to: z.string().trim().min(10, "Destination phone number is required"),
  templateName: z
    .string()
    .trim()
    .min(1, "Template name is required")
    .max(120)
    .default("test_message"),
  languageCode: z
    .string()
    .trim()
    .min(2, "Language code is required")
    .max(10)
    .default("en"),
  components: z.array(z.unknown()).optional(),
});
