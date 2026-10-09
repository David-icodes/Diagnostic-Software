import { ApiError } from "../../utils/api-error";

export const LIS_TEMPLATES = {
  lab_report_ready: { label: "Reports", languageSetting: "WHATSAPP_LAB_REPORT_READY_LANGUAGE", document: true },
  lab_invoice_ready: { label: "Bills / Invoice", languageSetting: "WHATSAPP_LAB_INVOICE_READY_LANGUAGE", document: true },
  patient_thank_you: { label: "Thanks / Greetings", languageSetting: "WHATSAPP_PATIENT_THANK_YOU_LANGUAGE", document: false },
} as const;
export type LisTemplate = keyof typeof LIS_TEMPLATES;

export interface TemplateValues {
  patientName: string; centreName: string; patientCode: string; billNumber: string;
  billDate: string; reportDate?: string; net: number; paid: number; balance: number;
}

export function templateVariables(template: LisTemplate, value: TemplateValues): string[] {
  const common = [value.patientName, value.centreName, value.patientName, value.patientCode, value.billNumber];
  const variables = template === "patient_thank_you" ? common.slice(0, 2)
    : template === "lab_report_ready" ? [...common, value.reportDate ?? ""]
    : [...common, value.billDate, ...[value.net, value.paid, value.balance].map((amount) => {
      if (!Number.isFinite(amount) || amount < 0) throw new ApiError(422, "Invoice amounts are invalid");
      return amount.toFixed(2);
    })];
  if (variables.some((text) => !text.trim())) throw new ApiError(422, "Required template information is unavailable");
  return variables;
}

export function templateComponents(template: LisTemplate, variables: string[], mediaId?: string, filename?: string) {
  if (LIS_TEMPLATES[template].document && !mediaId) throw new ApiError(422, "The generated PDF attachment is required");
  return [
    ...(LIS_TEMPLATES[template].document ? [{ type: "header", parameters: [{ type: "document", document: { id: mediaId, filename } }] }] : []),
    { type: "body", parameters: variables.map((text) => ({ type: "text", text })) },
  ];
}

export function languageFor(template: LisTemplate, config: Record<string, unknown>): string {
  const setting = LIS_TEMPLATES[template].languageSetting;
  const language = config[setting];
  if (typeof language !== "string" || !language.trim()) {
    throw new ApiError(503, `Configure ${setting} with the exact language code from Meta for ${template}.`);
  }
  return language.trim();
}
