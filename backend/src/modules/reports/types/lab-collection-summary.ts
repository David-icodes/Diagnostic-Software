export interface LabCollectionSummaryRow {
  id: string;
  reportDate: string;
  labAmount: number;
  expenses: number;
}

export interface LabCollectionSummaryMeta {
  expensesUnavailable: boolean;
  expensesNote: string;
}

export interface LabCollectionSummarySummary {
  totalLabAmount: number;
  totalExpenses: number;
  profit: number;
  profitPercent: number;
}

export interface LabCollectionSummaryResult {
  data: LabCollectionSummaryRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  summary: LabCollectionSummarySummary;
  meta: LabCollectionSummaryMeta;
}