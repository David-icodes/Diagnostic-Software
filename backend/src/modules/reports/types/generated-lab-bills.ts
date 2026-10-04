export type ReportPaymentStatus = "paid" | "partial" | "unpaid";

export interface GeneratedLabBillReportRow {
  id: string;
  billNumber: string;
  billDate: string;
  patientId: string;
  patientName: string;
  patientType: string;
  tests: string[];
  departments: string[];
  /** Referring doctor's name as snapshotted on the bill. */
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
  /** Name of the user who created/collected the bill. */
  collectedBy: string;
  paymentStatus: ReportPaymentStatus | "free";
  status: "generated" | "cancelled";
}

export interface GeneratedLabBillsSummary {
  totalBills: number;
  totalAmount: number;
  totalDiscount: number;
  totalNet: number;
  totalPaid: number;
  totalDue: number;
}

export interface GeneratedLabBillsPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface GeneratedLabBillsResult {
  data: GeneratedLabBillReportRow[];
  pagination: GeneratedLabBillsPagination;
  summary: GeneratedLabBillsSummary;
}