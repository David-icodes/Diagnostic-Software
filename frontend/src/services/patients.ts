import { api } from "@/lib/api";
import type {
  DeletePatientResponse,
  PaginatedResult,
  Patient,
  PatientResponse,
} from "@/types/patient";
import type { PatientFormValues } from "@/validations/patient";

export interface PatientListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

export function fetchPatients(
  params: PatientListParams = {},
): Promise<PaginatedResult<Patient>> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);

  const qs = query.toString();
  return api.get<PaginatedResult<Patient>>(`/patients${qs ? `?${qs}` : ""}`);
}

export function fetchPatient(idOrPatientId: string): Promise<Patient> {
  return api
    .get<PatientResponse>(`/patients/${encodeURIComponent(idOrPatientId)}`)
    .then((response) => response.patient);
}

export function createPatient(body: PatientFormValues): Promise<Patient> {
  return api.post<PatientResponse>("/patients", body)
    .then((response) => response.patient);
}

export function updatePatient(
  idOrPatientId: string,
  body: PatientFormValues,
): Promise<Patient> {
  return api
    .put<PatientResponse>(`/patients/${encodeURIComponent(idOrPatientId)}`, body)
    .then((response) => response.patient);
}

/**
 * Deletes a patient registration. The backend archives it (`status: inactive`)
 * instead of removing the row, so linked bills, samples and results survive.
 */
export function deletePatient(
  idOrPatientId: string,
): Promise<DeletePatientResponse> {
  return api.delete<DeletePatientResponse>(
    `/patients/${encodeURIComponent(idOrPatientId)}`,
  );
}