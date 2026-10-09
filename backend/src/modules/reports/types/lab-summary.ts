export type LabSummaryLabStatus = "OPEN" | "CLOSED";
export type LabSummaryApprovalStatus = "PENDING" | "APPROVED";

export interface LabSummaryReportRow {
  id: string;
  billNumber: string;
  reportDate: string;
  patientId: string;
  patientName: string;
  patientType: string;
  departmentName: string;
  testName: string;
  /** Lab sample id for the (bill, test) pair; `""` when no sample exists yet. */
  upId: string;
  /** Stored sample workflow status; `""` when no sample exists yet. */
  sampleStatus: string;
  /** Sample collection timestamp; `""` when not collected yet. */
  collectedOn: string;
  labStatus: LabSummaryLabStatus;
  approvalStatus: LabSummaryApprovalStatus;
  /** User who entered the latest result for the test; `""` when none. */
  enteredBy: string;
  /** Entry timestamp of the latest result; `""` when none. */
  enteredOn: string;
  delayedTat: boolean;
  amount: number;
}

export interface LabSummaryMeta {
  delayedTatHours: number;
  labStatusBasis: string;
  approvalStatusBasis: string;
}

export interface LabSummarySummary {
  totalBills: number;
  income: number;
  due: number;
  profit: null;
  totalTests: number;
  totalDelayed: number;
  totalAmount: number;
}

export interface LabSummaryResult {
  data: LabSummaryReportRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  summary: LabSummarySummary;
  meta: LabSummaryMeta;
}
