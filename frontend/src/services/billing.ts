import { api } from "@/lib/api";
import type {
  CancelLabBillRequest,
  ClientResponse,
  CollectDueRequest,
  Department,
  DepartmentResponse,
  Doctor,
  DoctorResponse,
  LabBill,
  LabBillResponse,
  CreateLabBillRequest,
  LabClient,
  LabTest,
  LabTestListResult,
  LabTestResponse,
  ModifyLabBillRequest,
} from "@/types/billing";
import type { Pagination } from "@/types/patient";

export interface CatalogListParams {
  search?: string;
  status?: string;
  limit?: number;
}

export function fetchDepartments(
  params: CatalogListParams = {},
): Promise<Department[]> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  const qs = query.toString();
  return api.get<Department[]>(`/departments${qs ? `?${qs}` : ""}`);
}

export function createDepartment(
  body: Record<string, unknown>,
): Promise<Department> {
  return api
    .post<DepartmentResponse>("/departments", body)
    .then((response) => response.department);
}

export function updateDepartment(
  id: string,
  body: Record<string, unknown>,
): Promise<Department> {
  return api
    .put<DepartmentResponse>(`/departments/${encodeURIComponent(id)}`, body)
    .then((response) => response.department);
}

export interface LabTestListParams {
  departmentId?: string;
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export function fetchLabTests(
  params: LabTestListParams = {},
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

export function fetchLabTest(id: string): Promise<LabTest> {
  return api
    .get<LabTestResponse>(`/lab-tests/${encodeURIComponent(id)}`)
    .then((response) => response.test);
}

export function createLabTest(
  body: Record<string, unknown>,
): Promise<LabTest> {
  return api
    .post<LabTestResponse>("/lab-tests", body)
    .then((response) => response.test);
}

export function updateLabTest(
  id: string,
  body: Record<string, unknown>,
): Promise<LabTest> {
  return api
    .put<LabTestResponse>(`/lab-tests/${encodeURIComponent(id)}`, body)
    .then((response) => response.test);
}

export function fetchDoctors(params: CatalogListParams = {}): Promise<Doctor[]> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return api.get<Doctor[]>(`/doctors${qs ? `?${qs}` : ""}`);
}

export function createDoctor(body: Record<string, unknown>): Promise<Doctor> {
  return api
    .post<DoctorResponse>("/doctors", body)
    .then((response) => response.doctor);
}

export interface BillListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  billType?: string;
}

export interface BillListResult {
  data: LabBill[];
  pagination: Pagination;
}

export function fetchLabBills(
  params: BillListParams = {},
): Promise<BillListResult> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  if (params.fromDate) query.set("fromDate", params.fromDate);
  if (params.toDate) query.set("toDate", params.toDate);
  if (params.billType) query.set("billType", params.billType);
  const qs = query.toString();
  return api.get<BillListResult>(`/lab-bills${qs ? `?${qs}` : ""}`);
}

export function fetchLabBill(id: string): Promise<LabBill> {
  return api
    .get<LabBillResponse>(`/lab-bills/${encodeURIComponent(id)}`)
    .then((response) => response.bill);
}

export function createLabBill(body: CreateLabBillRequest): Promise<LabBill> {
  return api
    .post<LabBillResponse>("/lab-bills", body)
    .then((response) => response.bill);
}

export function fetchLabBillByBillNumber(billNumber: string): Promise<LabBill> {
  return api
    .get<LabBillResponse>(`/lab-bills/by-bill-number/${encodeURIComponent(billNumber)}`)
    .then((response) => response.bill);
}

export function cancelLabBill(
  id: string,
  body: CancelLabBillRequest,
): Promise<LabBill> {
  return api
    .post<LabBillResponse>(`/lab-bills/${encodeURIComponent(id)}/cancel`, body)
    .then((response) => response.bill);
}

export interface DueBillsParams {
  page?: number;
  limit?: number;
  fromDate?: string;
  toDate?: string;
  patientId?: string;
  patientName?: string;
  billNumber?: string;
}

export function fetchDueBills(params: DueBillsParams = {}): Promise<BillListResult> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.fromDate) query.set("fromDate", params.fromDate);
  if (params.toDate) query.set("toDate", params.toDate);
  if (params.patientId) query.set("patientId", params.patientId);
  if (params.patientName) query.set("patientName", params.patientName);
  if (params.billNumber) query.set("billNumber", params.billNumber);
  const qs = query.toString();
  return api.get<BillListResult>(`/lab-bills/due${qs ? `?${qs}` : ""}`);
}

export function collectLabDue(id: string, body: CollectDueRequest): Promise<LabBill> {
  return api
    .post<LabBillResponse>(`/lab-bills/${encodeURIComponent(id)}/collect-due`, body)
    .then((response) => response.bill);
}

export function modifyLabBill(
  id: string,
  body: ModifyLabBillRequest,
): Promise<LabBill> {
  return api
    .put<LabBillResponse>(`/lab-bills/${encodeURIComponent(id)}`, body)
    .then((response) => response.bill);
}

export interface ClientListParams {
  search?: string;
  limit?: number;
}

export function fetchClients(params: ClientListParams = {}): Promise<LabClient[]> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return api.get<LabClient[]>(`/lab-clients${qs ? `?${qs}` : ""}`);
}

export function fetchClient(id: string): Promise<LabClient> {
  return api
    .get<ClientResponse>(`/lab-clients/${encodeURIComponent(id)}`)
    .then((response) => response.client);
}

export function createClient(body: Record<string, unknown>): Promise<LabClient> {
  return api
    .post<ClientResponse>("/lab-clients", body)
    .then((response) => response.client);
}

export function updateClient(
  id: string,
  body: Record<string, unknown>,
): Promise<LabClient> {
  return api
    .put<ClientResponse>(`/lab-clients/${encodeURIComponent(id)}`, body)
    .then((response) => response.client);
}