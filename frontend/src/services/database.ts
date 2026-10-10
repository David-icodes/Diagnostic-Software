import { api } from "@/lib/api";
import type {
  DatabaseOptions,
  Doctor,
  DoctorResponse,
  LabPackage,
  Location,
  LocationLevel,
  LocationResponse,
  MasterRecord,
  MasterResponse,
  PaginatedResult,
  PackagePayloadItem,
  PackageResponse,
} from "@/types/database";
import type { Department, DepartmentResponse } from "@/types/billing";

export interface DatabaseListParams {
  page?: number;
  limit?: number;
  search?: string;
}

export function getDatabaseOptions(): Promise<DatabaseOptions> {
  return api.get<DatabaseOptions>("/database/options");
}

export function fetchSpecialisations(
  params: DatabaseListParams = {},
): Promise<PaginatedResult<MasterRecord>> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.search) qs.set("search", params.search);
  const query = qs.toString();
  return api.get<PaginatedResult<MasterRecord>>(
    `/database/doctor-specialisations${query ? `?${query}` : ""}`,
  );
}

export function createSpecialisation(
  name: string,
): Promise<MasterResponse> {
  return api.post<MasterResponse>("/database/doctor-specialisations", { name });
}

export function updateSpecialisation(
  id: string,
  name: string,
): Promise<MasterResponse> {
  return api.put<MasterResponse>(
    `/database/doctor-specialisations/${encodeURIComponent(id)}`,
    { name },
  );
}

export function setSpecialisationActive(
  id: string,
  active: boolean,
): Promise<MasterResponse> {
  return api.patch<MasterResponse>(
    `/database/doctor-specialisations/${encodeURIComponent(id)}/${
      active ? "activate" : "deactivate"
    }`,
  );
}

export function fetchDesignations(
  params: DatabaseListParams = {},
): Promise<PaginatedResult<MasterRecord>> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.search) qs.set("search", params.search);
  const query = qs.toString();
  return api.get<PaginatedResult<MasterRecord>>(
    `/database/doctor-designations${query ? `?${query}` : ""}`,
  );
}

export function createDesignation(
  name: string,
): Promise<MasterResponse> {
  return api.post<MasterResponse>("/database/doctor-designations", { name });
}

export function updateDesignation(
  id: string,
  name: string,
): Promise<MasterResponse> {
  return api.put<MasterResponse>(
    `/database/doctor-designations/${encodeURIComponent(id)}`,
    { name },
  );
}

export function setDesignationActive(
  id: string,
  active: boolean,
): Promise<MasterResponse> {
  return api.patch<MasterResponse>(
    `/database/doctor-designations/${encodeURIComponent(id)}/${
      active ? "activate" : "deactivate"
    }`,
  );
}

export interface FetchLocationsParams {
  type: LocationLevel;
  parentId?: string;
  active?: boolean;
}

export function fetchLocations(
  params: FetchLocationsParams,
): Promise<Location[]> {
  const qs = new URLSearchParams();
  qs.set("type", params.type);
  if (params.parentId) qs.set("parentId", params.parentId);
  if (params.active !== undefined) qs.set("active", String(params.active));
  return api.get<Location[]>(`/database/locations?${qs.toString()}`);
}

export interface CreateLocationPayload {
  type: LocationLevel;
  name: string;
  parentId?: string;
}

export function createLocation(
  payload: CreateLocationPayload,
): Promise<LocationResponse> {
  return api.post<LocationResponse>("/database/locations", payload);
}

export function updateLocation(
  id: string,
  name: string,
): Promise<LocationResponse> {
  return api.put<LocationResponse>(
    `/database/locations/${encodeURIComponent(id)}`,
    { name },
  );
}

export function setLocationActive(
  id: string,
  active: boolean,
): Promise<LocationResponse> {
  return api.patch<LocationResponse>(
    `/database/locations/${encodeURIComponent(id)}/${
      active ? "activate" : "deactivate"
    }`,
  );
}

export function fetchDatabaseDepartments(
  params: DatabaseListParams = {},
): Promise<Department[]> {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  const query = qs.toString();
  return api.get<Department[]>(`/departments${query ? `?${query}` : ""}`);
}

export function createDatabaseDepartment(payload: {
  name: string;
  code: string;
  description?: string;
  type?: string;
  sortOrder?: number;
}): Promise<DepartmentResponse> {
  return api.post<DepartmentResponse>("/departments", payload);
}

export function updateDatabaseDepartment(
  id: string,
  payload: {
    name?: string;
    code?: string;
    description?: string;
    type?: string;
    sortOrder?: number;
  },
): Promise<DepartmentResponse> {
  return api.put<DepartmentResponse>(
    `/departments/${encodeURIComponent(id)}`,
    payload,
  );
}

export function setDepartmentActive(
  id: string,
  active: boolean,
): Promise<DepartmentResponse> {
  return api.patch<DepartmentResponse>(
    `/departments/${encodeURIComponent(id)}/${active ? "activate" : "deactivate"}`,
  );
}

export interface FetchPackagesParams extends DatabaseListParams {
  active?: boolean;
}

export function fetchPackages(
  params: FetchPackagesParams = {},
): Promise<PaginatedResult<LabPackage>> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.search) qs.set("search", params.search);
  if (params.active !== undefined)
    qs.set("active", String(params.active));
  const query = qs.toString();
  return api.get<PaginatedResult<LabPackage>>(
    `/database/packages${query ? `?${query}` : ""}`,
  );
}

export interface CreatePackagePayload {
  name: string;
  packageType: string;
  amount: number;
  insAmount?: number;
  items?: PackagePayloadItem[];
}

export function createPackage(
  payload: CreatePackagePayload,
): Promise<PackageResponse> {
  return api.post<PackageResponse>("/database/packages", payload);
}

export function updatePackage(
  id: string,
  payload: Partial<CreatePackagePayload>,
): Promise<PackageResponse> {
  return api.put<PackageResponse>(
    `/database/packages/${encodeURIComponent(id)}`,
    payload,
  );
}

export function setPackageActive(
  id: string,
  active: boolean,
): Promise<PackageResponse> {
  return api.patch<PackageResponse>(
    `/database/packages/${encodeURIComponent(id)}/${
      active ? "activate" : "deactivate"
    }`,
  );
}

export interface CreateDoctorPayload {
  employeeId?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  name?: string;
  shortName?: string;
  gender?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  city?: string;
  specialisationId?: string;
  designationId?: string;
  doctorType?: string;
  departmentId?: string;
  onlineAppDisplay?: "Y" | "N";
  address?: string;
  roomNumber?: string;
  qualification?: string;
  opConsultationFee?: number;
  ipConsultationFee?: number;
  hospitalFee?: number;
  erConsultationFee?: number;
  maxFreeVisits?: number;
  maxFreeDaysVisits?: number;
}

export function createDoctor(payload: CreateDoctorPayload): Promise<DoctorResponse> {
  return api.post<DoctorResponse>("/doctors", payload);
}

export function updateDoctor(
  id: string,
  payload: Partial<CreateDoctorPayload>,
): Promise<DoctorResponse> {
  return api.put<DoctorResponse>(`/doctors/${encodeURIComponent(id)}`, payload);
}

export function fetchDoctorsPaginated(
  params: DatabaseListParams = {},
): Promise<PaginatedResult<Doctor>> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.search) qs.set("search", params.search);
  const query = qs.toString();
  return api.get<PaginatedResult<Doctor>>(
    `/doctors/list${query ? `?${query}` : ""}`,
  );
}

export function setDoctorActive(
  id: string,
  active: boolean,
): Promise<DoctorResponse> {
  return api.patch<DoctorResponse>(
    `/doctors/${encodeURIComponent(id)}/${active ? "activate" : "deactivate"}`,
  );
}
export function deleteDatabaseDepartment(id: string): Promise<{ deleted: boolean }> {
  return api.delete(`/departments/${encodeURIComponent(id)}`);
}
