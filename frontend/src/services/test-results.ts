import { api } from "@/lib/api";
import type {
  BillResultEntry,
  LabSampleRow,
  LabTestParameter,
  LabTestResult,
  LabTechnician,
  SampleListParams,
  SampleListResponse,
  SampleStatusResponse,
  SubmitResultsData,
  SubmitResultsRequest,
  UpdateSampleStatusRequest,
} from "@/types/test-result";

export function fetchLabSamples(
  params: SampleListParams = {},
): Promise<SampleListResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  const mode = params.mode ?? "today";
  query.set("mode", mode);
  if (params.fromDate) query.set("fromDate", params.fromDate);
  if (params.toDate) query.set("toDate", params.toDate);
  if (params.billNumber) query.set("billNumber", params.billNumber);
  if (params.patientId) query.set("patientId", params.patientId);
  if (params.patientName) query.set("patientName", params.patientName);
  const qs = query.toString();
  return api.get<SampleListResponse>(`/lab-samples${qs ? `?${qs}` : ""}`);
}

export function updateSampleStatus(
  id: string,
  body: UpdateSampleStatusRequest,
): Promise<LabSampleRow> {
  return api
    .patch<SampleStatusResponse>(`/lab-samples/${encodeURIComponent(id)}/status`, body)
    .then((response) => response.sample);
}

export function fetchLabTestParameters(testId: string): Promise<LabTestParameter[]> {
  return api
    .get<{ parameters: LabTestParameter[] }>(
      `/lab-test-results/test-parameters?testId=${encodeURIComponent(testId)}`,
    )
    .then((response) => response.parameters);
}

/**
 * Loads a bill's ordered tests with the reference range that applies to its
 * patient. This is the entry point result entry uses instead of resolving ranges
 * in the browser, so what the technician sees is what gets recorded.
 */
export function fetchBillResultEntry(billId: string): Promise<BillResultEntry> {
  return api.get<BillResultEntry>(
    `/lab-test-results/bill-entry?billId=${encodeURIComponent(billId)}`,
  );
}

export function fetchTestResults(
  billId: string,
  testId: string,
): Promise<LabTestResult[]> {
  return api
    .get<{ results: LabTestResult[] }>(
      `/lab-test-results/results?billId=${encodeURIComponent(billId)}&testId=${encodeURIComponent(testId)}`,
    )
    .then((response) => response.results);
}

export function submitTestResults(
  body: SubmitResultsRequest,
): Promise<SubmitResultsData> {
  return api.post<SubmitResultsData>("/lab-test-results/results/submit", body);
}

export function fetchLabTechnicians(): Promise<LabTechnician[]> {
  return api
    .get<{ technicians: LabTechnician[] }>("/lab-technicians")
    .then((response) => response.technicians);
}