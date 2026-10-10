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

export interface DueBillsSummary {
  totalBills: number;
  totalAmount: number;
  totalDiscount: number;
  totalNet: number;
  totalPaid: number;
  totalBalance: number;
}

export interface DueBillsResult {
  data: DueBillReportRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  summary: DueBillsSummary;
}