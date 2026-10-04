export interface BillWiseCollectionRow {
  id: string;
  billTime: string;
  billNumber: string;
  billFor: string;
  patientId: string;
  patientName: string;
  refDoctor: string;
  paidAmount: number;
  modeBreakdown: Record<string, number>;
  payMode: string;
  collectedBy: string;
}

export interface BillWiseCollectionSummary {
  totalRecords: number;
  totalPaid: number;
  modeTotals: Record<string, number>;
}

export interface BillWiseCollectionResult {
  data: BillWiseCollectionRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  summary: BillWiseCollectionSummary;
  meta: {
    withCancelled: boolean;
  };
}