import { fullReportRows } from "@/lib/full-report-export";
import { api } from "@/lib/api";
import type {
  BillWiseCollectionParams,
  BillWiseCollectionResponse,
  CancelledBillsParams,
  CancelledBillsResponse,
  ClientGeneratedLabBillsParams,
  ClientGeneratedLabBillsResponse,
  DueBillsParams,
  DueBillsResponse,
  GeneratedLabBillsParams,
  GeneratedLabBillsResponse,
  HospitalPriceCardParams,
  HospitalPriceCardResponse,
  LabCollectionSummaryParams,
  LabCollectionSummaryResponse,
  LabSummaryParams,
  LabSummaryResponse,
  OspRegistrationParams,
  OspRegistrationResponse,
  OutsideLabOption,
  OutsideSentLabTestParams,
  OutsideSentLabTestResponse,
  ReferralDoctorCommissionParams,
  ReferralDoctorCommissionResponse,
  ReportOptions,
} from "@/types/reports";

/** Export every filtered row even when the existing server export cap is exceeded. */
async function getReport<T>(path: string, params: object): Promise<T> {
  const response = await api.get<T>(`${path}${buildQuery(params)}`);
  const input = params as { export?: string };
  const result = response as T & { data: unknown[]; pagination: { total: number; totalPages: number } };
  if (input.export !== "1" || !result.pagination || result.data.length >= result.pagination.total) return response;
  result.data = await fullReportRows(result, (page) => api.get<typeof result>(
    `${path}${buildQuery({ ...params, export: undefined, page, limit: 100 })}`,
  ));
  return response;
}

function buildQuery(params: object): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  }
  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

export function fetchGeneratedLabBills(
  params: GeneratedLabBillsParams = {},
): Promise<GeneratedLabBillsResponse> {
  const { export: exporting, ...query } = params;
  return api.get<GeneratedLabBillsResponse>(`/reports/generated-lab-bills${buildQuery(query)}`).then(async (response) => {
    if (exporting === "1") response.data = await fullReportRows(response, (page) => api.get<GeneratedLabBillsResponse>(
      `/reports/generated-lab-bills${buildQuery({ ...query, page, limit: 100 })}`));
    return response;
  });
}

export function fetchLabSummary(params: LabSummaryParams = {}): Promise<LabSummaryResponse> {
  return getReport<LabSummaryResponse>("/reports/lab-summary", params);
}

export function fetchOspRegistration(
  params: OspRegistrationParams = {},
): Promise<OspRegistrationResponse> {
  return getReport<OspRegistrationResponse>("/reports/osp-registration", params);
}

export function fetchReferralDoctorCommission(
  params: ReferralDoctorCommissionParams = {},
): Promise<ReferralDoctorCommissionResponse> {
  return getReport<ReferralDoctorCommissionResponse>("/reports/referral-doctor-commission", params);
}

export function fetchLabCollectionSummary(
  params: LabCollectionSummaryParams = {},
): Promise<LabCollectionSummaryResponse> {
  return getReport<LabCollectionSummaryResponse>("/reports/lab-collection-summary", params);
}

export function fetchClientGeneratedLabBills(
  params: ClientGeneratedLabBillsParams = {},
): Promise<ClientGeneratedLabBillsResponse> {
  return getReport<ClientGeneratedLabBillsResponse>("/reports/client-generated-lab-bills", params);
}

export function fetchOutsideSentLabTests(
  params: OutsideSentLabTestParams = {},
): Promise<OutsideSentLabTestResponse> {
  return getReport<OutsideSentLabTestResponse>("/reports/outside-sent-lab-tests", params);
}

export function fetchOutsideLabs(): Promise<OutsideLabOption[]> {
  return api.get<OutsideLabOption[]>("/reports/outside-labs");
}

export function fetchReportOptions(): Promise<ReportOptions> {
  return api.get<ReportOptions>("/reports/options");
}

export function fetchDueBills(
  params: DueBillsParams = {},
): Promise<DueBillsResponse> {
  return getReport<DueBillsResponse>("/reports/due-bills", params);
}

export function fetchCancelledBills(
  params: CancelledBillsParams = {},
): Promise<CancelledBillsResponse> {
  return getReport<CancelledBillsResponse>("/reports/cancelled-bills", params);
}

export function fetchBillWiseCollection(
  params: BillWiseCollectionParams = {},
): Promise<BillWiseCollectionResponse> {
  return getReport<BillWiseCollectionResponse>("/reports/bills-wise-collection", params);
}

export function fetchHospitalPriceCard(
  params: HospitalPriceCardParams = {},
): Promise<HospitalPriceCardResponse> {
  return getReport<HospitalPriceCardResponse>("/reports/hospital-price-card", params);
}
export type OutsideLabInput = Omit<OutsideLabOption, "id">;
export function saveOutsideLab(input: OutsideLabInput, id?: string): Promise<OutsideLabOption> {
  return id ? api.put(`/reports/outside-labs/${encodeURIComponent(id)}`, input) : api.post("/reports/outside-labs", input);
}
export function deleteOutsideLab(id: string): Promise<{ deleted: boolean }> {
  return api.delete(`/reports/outside-labs/${encodeURIComponent(id)}`);
}
