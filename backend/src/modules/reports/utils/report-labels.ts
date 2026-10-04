import { BILL_TYPES, PAYMENT_MODES, PATIENT_TYPES } from "../../../models/lab-bill.model";

export const BILL_TYPE_LABELS: Record<string, string> = {
  osp: "OSP",
  vendor: "Vendor",
};

export const PAY_MODE_LABELS: Record<string, string> = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  bank_transfer: "Bank Transfer",
  other: "Other",
};

/** Composite report patient types (`gp`/`op`/`ip`/`er`) → stored bill types. */
export const REPORT_PATIENT_TYPE_MAP: Record<string, string> = {
  gp: "osp",
  op: "op",
  ip: "ip",
  er: "emergency",
};

/** Stored bill patient types → display labels. */
export const PATIENT_TYPE_LABELS: Record<string, string> = {
  osp: "OSP",
  op: "OP",
  ip: "IP",
  emergency: "ER",
  corporate: "Corporate",
};

export function billTypeLabel(value: string | undefined): string {
  return BILL_TYPE_LABELS[value ?? ""] ?? value?.toUpperCase?.() ?? "—";
}

export function payModeLabel(value: string | undefined): string {
  return PAY_MODE_LABELS[value ?? ""] ?? value ?? "—";
}

export function patientTypeLabel(value: string | undefined): string {
  return PATIENT_TYPE_LABELS[value ?? ""] ?? value?.toUpperCase?.() ?? "—";
}

export interface ReportSelectOption {
  value: string;
  label: string;
}

export function billTypeOptions(deps: { billTypes?: typeof BILL_TYPES } = {}): ReportSelectOption[] {
  const values = deps.billTypes ?? BILL_TYPES;
  return values.map((value) => ({ value, label: BILL_TYPE_LABELS[value] ?? value }));
}

export function payModeOptions(deps: { payModes?: typeof PAYMENT_MODES } = {}): ReportSelectOption[] {
  const values = deps.payModes ?? PAYMENT_MODES;
  return values.map((value) => ({ value, label: PAY_MODE_LABELS[value] ?? value }));
}

export function patientTypeOptions(
  deps: { patientTypes?: typeof PATIENT_TYPES } = {},
): ReportSelectOption[] {
  const values = deps.patientTypes ?? PATIENT_TYPES;
  return values.map((value) => ({ value, label: PATIENT_TYPE_LABELS[value] ?? value }));
}