export interface OutsideSentLabTestRow {
  id: string;
  sentDate: string;
  labCenterName: string;
  patientId: string;
  patientName: string;
  testName: string;
  totalAmount: number;
}

export interface OutsideSentLabTestSummary {
  totalRecords: number;
  totalAmount: number;
}

export interface OutsideSentLabTestResult {
  data: OutsideSentLabTestRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  summary: OutsideSentLabTestSummary;
}