export type WhatsAppPreviewTemplate = "lab_report_ready" | "lab_invoice_ready" | "patient_thank_you";

// Approved Meta definitions read from the configured WABA on 9 October 2026.
// Preserve literal text, including the report's unexpected labels/trailing Foo.
export const APPROVED_WHATSAPP_BODIES: Record<WhatsAppPreviewTemplate, string> = {
  lab_report_ready: "Header:\nLaboratory Report\n\nBody:\n\nHello {{1}},\n\nYour laboratory report from {{2}} is ready.\n\nPatient Name: {{3}}\nPatient ID: {{4}}\nBill No: {{5}}\nReport Date: {{6}}\n\nPlease find your laboratory report attached to this message.\n\nThank you.\n\nFoo",
  lab_invoice_ready: "Hello {{1}},\n\nYour invoice from {{2}} has been generated.\n\nPatient Name: {{3}}\nPatient ID: {{4}}\nBill No: {{5}}\nBill Date: {{6}}\n\nNet Amount: ₹{{7}}\nPaid Amount: ₹{{8}}\nBalance: ₹{{9}}\n\nPlease find your invoice attached to this message.\n\nThank you.",
  patient_thank_you: "Hello {{1}},\n\nThank you for choosing {{2}}.\n\nWe appreciate your trust in us and look forward to serving you again.",
};
export const APPROVED_WHATSAPP_FOOTER = "Anjali Diagnostics";

export function whatsappPreview(template: WhatsAppPreviewTemplate, variables: string[]): string {
  return APPROVED_WHATSAPP_BODIES[template].replace(/\{\{(\d+)\}\}/g, (_, index: string) => variables[Number(index) - 1] ?? "");
}