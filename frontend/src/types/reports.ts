export type ReportPaymentStatus = "paid" | "partial" | "unpaid";
export type ReportBillStatus = "generated" | "cancelled";

export interface ReportPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ReportSelectOption {
  value: string;
  label: string;
}

export interface GeneratedLabBillReportRow {
  id: string;
  billNumber: string;
  billDate: string;
  patientId: string;
  patientName: string;
  patientType: string;
  tests: string[];
  departments: string[];
  /** Referring doctor's name snapshotted on the bill; `""` when not recorded. */
  doctorName: string;
  totalAmount: number;
  discountAmount: number;
  netAmount: number;
  paidAmount: number;
  dueAmount: number;
  /** Stored payment mode value (never re-derived). */
  paymentMode: string;
  /** Display label for `paymentMode`. */
  payModeLabel: string;
  /** Name of the user who created/collected the bill; `""` when unavailable. */
  collectedBy: string;
  paymentStatus: ReportPaymentStatus | "free";
  status: ReportBillStatus;
}

export interface GeneratedLabBillsSummary {
  totalBills: number;
  totalAmount: number;
  totalDiscount: number;
  totalNet: number;
  totalPaid: number;
  totalDue: number;
}

export interface GeneratedLabBillsResponse {
  data: GeneratedLabBillReportRow[];
  pagination: ReportPagination;
  summary: GeneratedLabBillsSummary;
}

export interface GeneratedLabBillsParams {
  page?: number;
  limit?: number;
  fromDate?: string;
  toDate?: string;
  patientId?: string;
  patientName?: string;
  billNumber?: string;
  patientType?: string;
  departmentId?: string;
  referringDoctorId?: string;
  paymentStatus?: ReportPaymentStatus;
  /** Comma-separated patient types (multi-select filter). */
  patientTypes?: string;
  /** Comma-separated stored payment modes (multi-select filter). */
  paymentModes?: string;
  /** Comma-separated referring doctor ids (multi-select filter). */
  referringDoctorIds?: string;
  /** Comma-separated user ids who collected the bills. */
  collectedByIds?: string;
  /** `"date_asc"` or `"date_desc"` (default). */
  orderBy?: GeneratedLabBillsOrder;
  /** `"1"` restricts the report to bills carrying a discount. */
  discountedOnly?: "1";
}

export type GeneratedLabBillsOrder = "date_asc" | "date_desc";

export const PATIENT_TYPE_OPTIONS: ReportSelectOption[] = [
  { value: "osp", label: "OSP" },
  { value: "op", label: "OP" },
  { value: "ip", label: "IP" },
  { value: "emergency", label: "Emergency" },
  { value: "corporate", label: "Corporate" },
];

export const PAYMENT_STATUS_OPTIONS: ReportSelectOption[] = [
  { value: "paid", label: "Paid" },
  { value: "partial", label: "Partial" },
  { value: "unpaid", label: "Unpaid" },
];

export function patientTypeLabel(value: string): string {
  return (
    PATIENT_TYPE_OPTIONS.find((option) => option.value === value)?.label ??
    value.toUpperCase()
  );
}

export function paymentStatusLabel(
  value: ReportPaymentStatus | "free",
): string {
  switch (value) {
    case "paid":
      return "Paid";
    case "partial":
      return "Partial";
    case "unpaid":
      return "Unpaid";
    case "free":
      return "Free";
    default:
      return value;
  }
}

// ---------------------------------------------------------------- Lab Summary
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

export interface LabSummaryResponse {
  data: LabSummaryReportRow[];
  pagination: ReportPagination;
  summary: {
    totalBills: number;
    income: number;
    due: number;
    profit: null;
    totalTests: number;
    totalDelayed: number;
    totalAmount: number;
  };
  meta: LabSummaryMeta;
}

export interface LabSummaryParams {
  page?: number;
  limit?: number;
  export?: "1";
  fromDate?: string;
  toDate?: string;
  departmentIds?: string;
  testIds?: string;
  patientTypes?: string;
  billNumber?: string;
  labStatus?: LabSummaryLabStatus;
  approvalStatus?: LabSummaryApprovalStatus;
  delayedTat?: "1";
}

export const REPORT_PATIENT_TYPE_OPTIONS: ReportSelectOption[] = [
  { value: "gp", label: "GP" },
  { value: "op", label: "OP" },
  { value: "ip", label: "IP" },
  { value: "er", label: "ER" },
];

export const GENDER_FILTER_OPTIONS: ReportSelectOption[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

export const BILL_TYPE_OPTIONS: ReportSelectOption[] = [
  { value: "osp", label: "OSP" },
  { value: "vendor", label: "Vendor" },
];

export const LAB_STATUS_OPTIONS: ReportSelectOption[] = [
  { value: "OPEN", label: "Open" },
  { value: "CLOSED", label: "Closed" },
];

export const APPROVAL_STATUS_OPTIONS: ReportSelectOption[] = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
];

// ----------------------------------------------------- OSP Patient Registration
export interface OspRegistrationReportRow {
  /** Patient document id — the target used by the delete action. */
  id: string;
  patientId: string;
  patientName: string;
  registrationDate: string;
  dateOfBirth: string | null;
  age: number | null;
  gender: string;
  mobile: string;
  address: string;
  /** Bill / test / package description built from the patient's registered bills. */
  billFor: string;
}

export interface OspRegistrationResponse {
  data: OspRegistrationReportRow[];
  pagination: ReportPagination;
  summary: { totalPatients: number; totalBills: number };
}

export interface OspRegistrationParams {
  page?: number;
  limit?: number;
  export?: "1";
  fromDate?: string;
  toDate?: string;
  gender?: string;
  mobile?: string;
  name?: string;
  billType?: string;
}

// ------------------------------------------------- Referral Doctor Commission
export type CommissionBasisValue = "referral" | "cons_op_ip";
export type CommissionAmountBasis = "net" | "paid";

export interface ReferralDoctorCommissionRow {
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

export interface ReferralDoctorCommissionResponse {
  data: ReferralDoctorCommissionRow[];
  pagination: ReportPagination;
  summary: {
    totalBills: number;
    totalNet: number;
    totalPaid: number;
    totalCommission: number;
    missingConfigs: number;
  };
  meta: {
    commissionBasis: CommissionBasisValue;
    amountBasis: CommissionAmountBasis;
    resolvedTypes: string[];
    claimTypes: string[];
  };
}

export interface ReferralDoctorCommissionParams {
  page?: number;
  limit?: number;
  export?: "1";
  fromDate?: string;
  toDate?: string;
  doctorIds?: string;
  departmentIds?: string;
  testIds?: string;
  patientId?: string;
  patientTypes?: string;
  commissionBasis?: CommissionBasisValue;
  amountBasis?: CommissionAmountBasis;
  claimType?: string;
}

export const COMMISSION_PATIENT_TYPE_OPTIONS: ReportSelectOption[] = [
  { value: "op", label: "OP" },
  { value: "ip", label: "IP" },
  { value: "gp", label: "GP" },
];

export const COMMISSION_CLAIM_TYPE_OPTIONS: ReportSelectOption[] = [
  { value: "all", label: "All" },
];

// ----------------------------------------------------- Lab Collection Summary
export interface LabCollectionSummaryRow {
  id: string;
  reportDate: string;
  labAmount: number;
  expenses: number;
}

export interface LabCollectionSummaryResponse {
  data: LabCollectionSummaryRow[];
  pagination: ReportPagination;
  summary: {
    totalLabAmount: number;
    totalExpenses: number;
    profit: number;
    profitPercent: number;
  };
  meta: {
    expensesUnavailable: boolean;
    expensesNote: string;
  };
}

export interface LabCollectionSummaryParams {
  page?: number;
  limit?: number;
  export?: "1";
  fromDate?: string;
  toDate?: string;
}

// ------------------------------------------------------ Client Generated Bills
export type ClientBillsOrderBy = "date_asc" | "date_desc";

export interface ClientGeneratedLabBillRow {
  paymentMode: string;
  id: string;
  billNumber: string;
  billDate: string;
  clientName: string;
  patientId: string;
  patientName: string;
  refDoctor: string;
  tests: string;
  totalAmount: number;
  discountAmount: number;
  netAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: ReportBillStatus;
}

export interface ClientGeneratedLabBillsResponse {
  data: ClientGeneratedLabBillRow[];
  pagination: ReportPagination;
  summary: {
    totalBills: number;
    totalAmount: number;
    totalDiscount: number;
    totalNet: number;
    totalPaid: number;
    totalDue: number;
  };
}

export interface ClientGeneratedLabBillsParams {
  page?: number;
  limit?: number;
  export?: "1";
  fromDate?: string;
  toDate?: string;
  clientIds?: string;
  referringDoctorId?: string;
  orderBy?: ClientBillsOrderBy;
}

export const CLIENT_BILLS_ORDER_OPTIONS: ReportSelectOption[] = [
  { value: "date_desc", label: "Descending" },
  { value: "date_asc", label: "Ascending" },
];

// ----------------------------------------------------- Outside Sent Lab Tests
export interface OutsideSentLabTestRow {
  id: string;
  sentDate: string;
  labCenterName: string;
  patientId: string;
  patientName: string;
  testName: string;
  totalAmount: number;
}

export interface OutsideSentLabTestResponse {
  data: OutsideSentLabTestRow[];
  pagination: ReportPagination;
  summary: { totalRecords: number; totalAmount: number };
}

export interface OutsideSentLabTestParams {
  page?: number;
  limit?: number;
  export?: "1";
  fromDate?: string;
  toDate?: string;
  outsideLabIds?: string;
}

export interface OutsideLabOption {
  id: string;
  code: string;
  name: string;
  city?: string;
}

// ------------------------------------------------------------ Shared options
export interface ReportOptions {
  billTypes: ReportSelectOption[];
  payModes: ReportSelectOption[];
  collectedByUsers: { id: string; name: string }[];
  priceCard: {
    serviceTypes: ReportSelectOption[];
    labNames: ReportSelectOption[];
    statuses: ReportSelectOption[];
  };
}

export const PAY_MODE_OPTIONS: ReportSelectOption[] = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "other", label: "Other" },
];

export function payModeLabel(value: string): string {
  return PAY_MODE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

// --------------------------------------------------------------- Due Bills
export interface DueBillReportRow {
  id: string;
  billNumber: string;
  billDate: string;
  billFor: string;
  patientId: string;
  patientName: string;
  totalAmount: number;
  discountAmount: number;
  netAmount: number;
  paidAmount: number;
  balance: number;
  payMode: string;
  collectedBy: string;
}

export interface DueBillsResponse {
  data: DueBillReportRow[];
  pagination: ReportPagination;
  summary: {
    totalBills: number;
    totalAmount: number;
    totalDiscount: number;
    totalNet: number;
    totalPaid: number;
    totalBalance: number;
  };
}

export interface DueBillsParams {
  page?: number;
  limit?: number;
  export?: "1";
  fromDate?: string;
  toDate?: string;
  patientId?: string;
  collectedByIds?: string;
}

// ------------------------------------------------------------ Cancelled Bills
export type CancelledBillsMode = "summary" | "detailed";

export interface CancelledBillReportRow {
  id: string;
  billNumber: string;
  billDate: string;
  cancelledAt: string;
  billFor: string;
  billType: string;
  patientId: string;
  patientName: string;
  tests: string[];
  netAmount: number;
  payMode: string;
  cancelledBy: string;
  remarks: string;
}

export interface CancelledBillsResponse {
  data: CancelledBillReportRow[];
  pagination: ReportPagination;
  summary: { totalBills: number; totalNet: number };
}

export interface CancelledBillsParams {
  page?: number;
  limit?: number;
  export?: "1";
  fromDate?: string;
  toDate?: string;
  billType?: string;
  payMode?: string;
  cancelledBy?: string;
  mode?: CancelledBillsMode;
}

// -------------------------------------------------------- Bills Wise Collection
export interface BillWiseCollectionRow {
  id: string;
  billTime: string;
  billNumber: string;
  billFor: string;
  patientId: string;
  patientName: string;
  refDoctor: string;
  paidAmount: number;
  /** Amount contributed to each pay-mode column for this payment. */
  modeBreakdown: Record<string, number>;
  payMode: string;
  collectedBy: string;
}

export interface BillWiseCollectionResponse {
  data: BillWiseCollectionRow[];
  pagination: ReportPagination;
  summary: {
    totalRecords: number;
    totalPaid: number;
    modeTotals: Record<string, number>;
  };
  meta: { withCancelled: boolean };
}

export interface BillWiseCollectionParams {
  page?: number;
  limit?: number;
  export?: "1";
  fromDate?: string;
  toDate?: string;
  patientId?: string;
  billType?: string;
  collectedBy?: string;
  payMode?: string;
  orderBy?: "date_asc" | "date_desc";
  withCancelled?: "1";
  patientTypes?: string;
}

export const BILL_WISE_ORDER_OPTIONS: ReportSelectOption[] = [
  { value: "date_desc", label: "Descending" },
  { value: "date_asc", label: "Ascending" },
];

// ----------------------------------------------------------- Hospital Price Card
export interface HospitalPriceCardRow {
  id: string;
  departmentName: string;
  testName: string;
  opAmount: number | null;
  ipAmount: number | null;
  insIpAmount: number | null;
  erAmount: number | null;
  insErAmount: number | null;
}

export interface HospitalPriceCardResponse {
  data: HospitalPriceCardRow[];
  pagination: ReportPagination;
  summary: { totalTests: number };
  meta: {
    tariffsUnavailable: boolean;
    tariffsNote: string;
  };
}

export interface HospitalPriceCardParams {
  page?: number;
  limit?: number;
  export?: "1";
  serviceType?: string;
  departmentId?: string;
  labName?: string;
  status?: string;
}

export const PRICE_CARD_STATUS_OPTIONS: ReportSelectOption[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "all", label: "All" },
];
