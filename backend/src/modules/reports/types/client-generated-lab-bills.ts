export type ClientBillsOrderBy = "date_asc" | "date_desc";

export interface ClientGeneratedLabBillRow {
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
  status: "generated" | "cancelled";
}

export interface ClientGeneratedLabBillsSummary {
  totalBills: number;
  totalAmount: number;
  totalDiscount: number;
  totalNet: number;
  totalPaid: number;
  totalDue: number;
}

export interface ClientGeneratedLabBillsResult {
  data: ClientGeneratedLabBillRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  summary: ClientGeneratedLabBillsSummary;
}