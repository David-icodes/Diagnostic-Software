export type CommissionBasisValue = "referral" | "cons_op_ip";
export type CommissionAmountBasis = "net" | "paid";

export interface ReferralDoctorCommissionRow {
  sNo: number;
  segmentTotal: number;
  segmentDiscount: number;
  id: string;
  billNumber: string;
  billDate: string;
  patientId: string;
  patientName: string;
  patientType: string;
  doctorName: string;
  tests: string;
  segmentNet: number;
  segmentPaid: number;
  commissionAmount: number | null;
  rateUsed: number | null;
  configMissing: boolean;
}

export interface ReferralDoctorCommissionSummary {
  totalBills: number;
  totalNet: number;
  totalPaid: number;
  totalCommission: number;
  missingConfigs: number;
}

export interface ReferralDoctorCommissionMeta {
  commissionBasis: CommissionBasisValue;
  amountBasis: CommissionAmountBasis;
  resolvedTypes: string[];
  claimTypes: string[];
}

export interface ReferralDoctorCommissionResult {
  data: ReferralDoctorCommissionRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  summary: ReferralDoctorCommissionSummary;
  meta: ReferralDoctorCommissionMeta;
}