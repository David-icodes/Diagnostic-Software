type Review = {
  templateName: string;
  attachment: { filename: string; base64: string; mimeType: string } | null;
};
export function whatsappAttachmentReady(template: string, review?: Review): boolean {
  if (!review || review.templateName !== template) return false;
  if (template === "patient_thank_you") return review.attachment === null;
  if (!["lab_report_ready", "lab_invoice_ready"].includes(template)) return false;
  return Boolean(review.attachment?.filename.endsWith(".pdf") &&
    review.attachment.mimeType === "application/pdf" && review.attachment.base64.startsWith("JVBERi0"));
}