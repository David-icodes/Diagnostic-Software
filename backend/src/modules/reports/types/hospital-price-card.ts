export interface HospitalPriceCardRow {
  id: string;
  departmentName: string;
  testName: string;
  /** Out-patient tariff. The only tariff the LIS stores per test today. */
  opAmount: number | null;
  /** Not stored; returned as null so the UI can show "—" instead of inventing tariffs. */
  ipAmount: number | null;
  insIpAmount: number | null;
  erAmount: number | null;
  insErAmount: number | null;
}

export interface HospitalPriceCardMeta {
  tariffsUnavailable: boolean;
  tariffsNote: string;
}

export interface HospitalPriceCardSummary {
  totalTests: number;
}

export interface HospitalPriceCardResult {
  data: HospitalPriceCardRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  summary: HospitalPriceCardSummary;
  meta: HospitalPriceCardMeta;
}