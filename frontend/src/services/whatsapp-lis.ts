import { api } from "@/lib/api";
import type { LabBill } from "@/types/billing";
import type { LabTestParameter, LabTestResult, LabTechnician, ReferenceResolution } from "@/types/test-result";
import type { ResultPrintMode } from "@/lib/result-workflow";

export const LIS_WHATSAPP_TEMPLATES = {
  lab_report_ready: "Reports",
  lab_invoice_ready: "Bills / Invoice",
  patient_thank_you: "Thanks / Greetings",
} as const;
export type LisWhatsAppTemplate = keyof typeof LIS_WHATSAPP_TEMPLATES;
export interface LisWhatsAppInput {
  patientId: string; billId: string; templateName: LisWhatsAppTemplate;
  workflow?: "parameter-results" | "lab-reprint";
  testIds: string[]; technicianId?: string; onlyEntered: boolean; printMode: ResultPrintMode;
}
export interface LisWhatsAppReview {
  reviewId: string; templateName: LisWhatsAppTemplate; languageCode: string | null;
  configurationError: string | null; patientName: string; patientCode: string; mobile: string;
  centreName: string; billNumber: string; billDate: string; variables: string[];
  attachment: { filename: string; base64: string; mimeType: string } | null;
}
export interface LisWhatsAppDocument {
  templateName: LisWhatsAppTemplate; bill: LabBill; printedBy: string;
  technician: LabTechnician | null; onlyEntered: boolean; printMode: ResultPrintMode;
  reports: Array<{
    item: LabBill["items"][number]; parameters: LabTestParameter[]; results: LabTestResult[];
    resolvedReferences: Record<string, string>; referenceResolutions: Record<string, ReferenceResolution>;
    collectedOn?: string;
  }>;
}
export const reviewLisWhatsApp = (input: LisWhatsAppInput) => api.postFromOrigin<LisWhatsAppReview>("/api/whatsapp/lis/review", input);
export const sendLisWhatsApp = (reviewId: string) => api.postFromOrigin<{ metaMessageId: string; waId?: string }>("/api/whatsapp/lis/send", { reviewId });
export const fetchLisWhatsAppDocument = (reviewId: string) => api.postFromOrigin<LisWhatsAppDocument>("/api/whatsapp/lis/document-data", { reviewId });

export interface LisDeliveryStatus {
  metaMessageId: string; templateName: string; languageCode?: string; workflow: string;
  status: "accepted" | "sent" | "delivered" | "read" | "failed"; errorCode?: string;
  message: string; createdAt?: string;
}
export const fetchLisDelivery = (billId: string) => api.postFromOrigin<LisDeliveryStatus[]>("/api/whatsapp/lis/delivery", { billId });
