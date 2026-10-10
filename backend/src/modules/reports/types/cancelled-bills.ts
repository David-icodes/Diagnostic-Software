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

export interface CancelledBillsSummary {
  totalBills: number;
  totalNet: number;
}

export interface CancelledBillsResult {
  data: CancelledBillReportRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  summary: CancelledBillsSummary;
}