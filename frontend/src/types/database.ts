export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: Pagination;
}

export interface DatabaseOptions {
  departmentTypes: string[];
  packageTypes: string[];
  doctorTypes: string[];
  genders: string[];
  yesNoOptions: string[];
  parameterTypes?: string[];
  parameterResultTypes?: string[];
  parameterReferenceTypes?: string[];
  /** Reference classification: Generic / Age / Sex / Age & Sex. */
  parameterReferenceScopes?: string[];
  /** Gender-wise range rows, in display order: M, F, C. */
  genderRangeGenders?: string[];
}

export interface MasterRecord {
  id: string;
  name: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type MasterResponse =
  | { specialisation: MasterRecord }
  | { designation: MasterRecord };

export type LocationLevel = "country" | "state" | "district" | "city";

export interface Location {
  id: string;
  type: LocationLevel;
  name: string;
  parentId?: string | null;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface LocationResponse {
  location: Location;
}

export interface PackageItem {
  testId: string;
  testCode: string;
  testName: string;
  departmentId: string;
  departmentName: string;
}

export interface LabPackage {
  id: string;
  name: string;
  packageType: string;
  amount: number;
  insAmount?: number;
  active: boolean;
  items: PackageItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface PackageResponse {
  package: LabPackage;
}

export interface PackagePayloadItem {
  testId: string;
  departmentId: string;
}

export interface Doctor {
  id: string;
  name: string;
  employeeId?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  shortName?: string;
  gender?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  city?: string;
  specialisationId?: string;
  specialization?: string;
  designationId?: string;
  designation?: string;
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
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface DoctorResponse {
  doctor: Doctor;
}

export const LOCATION_LEVEL_ORDER: LocationLevel[] = [
  "country",
  "state",
  "district",
  "city",
];

export const LOCATION_LEVEL_LABELS: Record<LocationLevel, string> = {
  country: "Country",
  state: "State",
  district: "District",
  city: "City",
};