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
  return api.get<GeneratedLabBillsResponse>(
    `/reports/generated-lab-bills${buildQuery(params)}`,
  );
}

export function fetchLabSummary(params: LabSummaryParams = {}): Promise<LabSummaryResponse> {
  return api.get<LabSummaryResponse>(`/reports/lab-summary${buildQuery(params)}`);
}

export function fetchOspRegistration(
  params: OspRegistrationParams = {},
): Promise<OspRegistrationResponse> {
  return api.get<OspRegistrationResponse>(
    `/reports/osp-registration${buildQuery(params)}`,
  );
}

export function fetchReferralDoctorCommission(
  params: ReferralDoctorCommissionParams = {},
): Promise<ReferralDoctorCommissionResponse> {
  return api.get<ReferralDoctorCommissionResponse>(
    `/reports/referral-doctor-commission${buildQuery(params)}`,
  );
}

export function fetchLabCollectionSummary(
  params: LabCollectionSummaryParams = {},
): Promise<LabCollectionSummaryResponse> {
  return api.get<LabCollectionSummaryResponse>(
    `/reports/lab-collection-summary${buildQuery(params)}`,
  );
}

export function fetchClientGeneratedLabBills(
  params: ClientGeneratedLabBillsParams = {},
): Promise<ClientGeneratedLabBillsResponse> {
  return api.get<ClientGeneratedLabBillsResponse>(
    `/reports/client-generated-lab-bills${buildQuery(params)}`,
  );
}

export function fetchOutsideSentLabTests(
  params: OutsideSentLabTestParams = {},
): Promise<OutsideSentLabTestResponse> {
  return api.get<OutsideSentLabTestResponse>(
    `/reports/outside-sent-lab-tests${buildQuery(params)}`,
  );
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
  return api.get<DueBillsResponse>(`/reports/due-bills${buildQuery(params)}`);
}

export function fetchCancelledBills(
  params: CancelledBillsParams = {},
): Promise<CancelledBillsResponse> {
  return api.get<CancelledBillsResponse>(
    `/reports/cancelled-bills${buildQuery(params)}`,
  );
}

export function fetchBillWiseCollection(
  params: BillWiseCollectionParams = {},
): Promise<BillWiseCollectionResponse> {
  return api.get<BillWiseCollectionResponse>(
    `/reports/bills-wise-collection${buildQuery(params)}`,
  );
}

export function fetchHospitalPriceCard(
  params: HospitalPriceCardParams = {},
): Promise<HospitalPriceCardResponse> {
  return api.get<HospitalPriceCardResponse>(
    `/reports/hospital-price-card${buildQuery(params)}`,
  );
}