import { api } from "@/lib/api";
import type { Pagination } from "@/types/database";
import type { Doctor, LabClient } from "@/types/billing";
import type {
  ClientTariffApplyResult,
  ClientTariffRow,
  CommissionActionResult,
  CommissionMappingInput,
  CommissionMappingRow,
  LabTestListResult,
  LabTestPayload,
  LabTestResponse,
  LabTestRow,
  PaginatedParameters,
  PaginatedTariffs,
  ParameterDetail,
  ParameterPayload,
  ParameterResponse,
  ParameterRow,
  ReferenceMappingPayload,
  ReferenceMappingsResponse,
  SpecimenOptions,
  TariffPriceInput,
} from "@/types/lab-masters";

export interface LabTestMasterParams {
  departmentId?: string;
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export function fetchLabMasterTests(
  params: LabTestMasterParams = {},
): Promise<LabTestListResult> {
  const query = new URLSearchParams();
  if (params.departmentId) query.set("departmentId", params.departmentId);
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return api.get<LabTestListResult>(`/lab-tests${qs ? `?${qs}` : ""}`);
}

export function createLabMasterTest(body: LabTestPayload): Promise<LabTestRow> {
  return api
    .post<LabTestResponse>("/lab-tests", body)
    .then((response) => response.test);
}

export function updateLabMasterTest(
  id: string,
  body: Partial<LabTestPayload>,
): Promise<LabTestRow> {
  return api
    .put<LabTestResponse>(`/lab-tests/${encodeURIComponent(id)}`, body)
    .then((response) => response.test);
}

export function setLabTestActive(id: string, active: boolean): Promise<LabTestRow> {
  return api
    .patch<LabTestResponse>(
      `/lab-tests/${encodeURIComponent(id)}/${active ? "activate" : "deactivate"}`,
    )
    .then((response) => response.test);
}

export async function fetchSpecimenOptions(): Promise<SpecimenOptions> {
  return api.get<SpecimenOptions>("/lab-tests/specimen-options");
}

export interface LabParameterParams {
  departmentId?: string;
  testId?: string;
  mode?: string;
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export function fetchLabParameters(
  params: LabParameterParams = {},
): Promise<PaginatedParameters> {
  const query = new URLSearchParams();
  if (params.departmentId) query.set("departmentId", params.departmentId);
  if (params.testId) query.set("testId", params.testId);
  if (params.mode) query.set("mode", params.mode);
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return api.get<PaginatedParameters>(`/lab-test-parameters${qs ? `?${qs}` : ""}`);
}

export function fetchLabParameterSubtitles(testId: string): Promise<string[]> {
  return api
    .get<{ subtitles: string[] }>(
      `/lab-test-parameters/subtitles?testId=${encodeURIComponent(testId)}`,
    )
    .then((response) => response.subtitles);
}

export function createLabParameter(body: ParameterPayload): Promise<ParameterRow> {
  return api
    .post<ParameterResponse>("/lab-test-parameters", body)
    .then((response) => response.parameter);
}

export function updateLabParameter(
  id: string,
  body: Partial<ParameterPayload>,
): Promise<ParameterRow> {
  return api
    .put<ParameterResponse>(`/lab-test-parameters/${encodeURIComponent(id)}`, body)
    .then((response) => response.parameter);
}

export function deleteLabParameter(id: string): Promise<ParameterRow> {
  return api
    .delete<ParameterResponse>(`/lab-test-parameters/${encodeURIComponent(id)}`)
    .then((response) => response.parameter);
}

export function fetchLabParameter(id: string): Promise<ParameterDetail> {
  return api
    .get<ParameterResponse>(`/lab-test-parameters/${encodeURIComponent(id)}`)
    .then((response) => response.parameter);
}

/**
 * Reference mappings are subdocuments of the parameter, so they share its
 * permissions. Deleting one leaves the parameter and its generic range alone.
 */
export function fetchParameterMappings(
  parameterId: string,
): Promise<ReferenceMappingsResponse> {
  return api.get<ReferenceMappingsResponse>(
    `/lab-test-parameters/${encodeURIComponent(parameterId)}/mappings`,
  );
}

export function createParameterMapping(
  parameterId: string,
  body: ReferenceMappingPayload,
): Promise<ParameterDetail> {
  return api
    .post<ParameterResponse>(
      `/lab-test-parameters/${encodeURIComponent(parameterId)}/mappings`,
      body,
    )
    .then((response) => response.parameter);
}

export function updateParameterMapping(
  parameterId: string,
  mappingId: string,
  body: Partial<ReferenceMappingPayload>,
): Promise<ParameterDetail> {
  return api
    .put<ParameterResponse>(
      `/lab-test-parameters/${encodeURIComponent(parameterId)}/mappings/${encodeURIComponent(mappingId)}`,
      body,
    )
    .then((response) => response.parameter);
}

export function deleteParameterMapping(
  parameterId: string,
  mappingId: string,
): Promise<ParameterDetail> {
  return api
    .delete<ParameterResponse>(
      `/lab-test-parameters/${encodeURIComponent(parameterId)}/mappings/${encodeURIComponent(mappingId)}`,
    )
    .then((response) => response.parameter);
}

export function setLabParameterActive(id: string, active: boolean): Promise<ParameterRow> {
  return api
    .patch<ParameterResponse>(
      `/lab-test-parameters/${encodeURIComponent(id)}/${active ? "activate" : "deactivate"}`,
    )
    .then((response) => response.parameter);
}

export interface LabTariffParams {
  departmentId?: string;
  page?: number;
  limit?: number;
}

export function fetchLabTariffs(
  params: LabTariffParams = {},
): Promise<PaginatedTariffs> {
  const query = new URLSearchParams();
  if (params.departmentId) query.set("departmentId", params.departmentId);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return api.get<PaginatedTariffs>(`/lab-tariffs${qs ? `?${qs}` : ""}`);
}

export interface BulkTariffResult {
  updated: number;
}

export function updateLabTariffs(rows: TariffPriceInput[]): Promise<BulkTariffResult> {
  return api.put<BulkTariffResult>("/lab-tariffs/bulk", { rows });
}

export function fetchCommissionMappings(
  doctorId: string,
  departmentId: string,
): Promise<CommissionMappingRow[]> {
  const query = new URLSearchParams();
  query.set("doctorId", doctorId);
  query.set("departmentId", departmentId);
  return api.get<CommissionMappingRow[]>(`/commission-mappings?${query.toString()}`);
}

export function assignCommissionMappings(
  doctorId: string,
  departmentId: string,
  mappings: CommissionMappingInput[],
  overwrite: boolean,
): Promise<CommissionActionResult> {
  return api.post<CommissionActionResult>("/commission-mappings/assign", {
    doctorId,
    departmentId,
    overwrite,
    mappings,
  });
}

export function fetchClientTariffs(
  clientId: string,
  departmentId: string,
): Promise<ClientTariffRow[]> {
  const query = new URLSearchParams();
  query.set("clientId", clientId);
  query.set("departmentId", departmentId);
  return api.get<ClientTariffRow[]>(`/client-tariffs?${query.toString()}`);
}

export function applyClientTariffs(
  clientId: string,
  departmentId: string,
  rows: { testId: string; price: number }[],
  overwrite: boolean,
): Promise<ClientTariffApplyResult> {
  return api.put<ClientTariffApplyResult>("/client-tariffs/apply", {
    clientId,
    departmentId,
    overwrite,
    rows,
  });
}

const PAGE_LIMIT = 100;

export function fetchAllActiveDoctors(): Promise<Doctor[]> {
  return api.get<Doctor[]>(`/doctors?limit=${PAGE_LIMIT}`);
}

export function fetchAllActiveClients(): Promise<LabClient[]> {
  return api.get<LabClient[]>(`/lab-clients?limit=${PAGE_LIMIT}`);
}

export type { Pagination };