export const GENDERS = ["male", "female", "other"] as const;
export type PatientGender = (typeof GENDERS)[number];

export const BLOOD_GROUPS = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
  "Unknown",
] as const;
export type PatientBloodGroup = (typeof BLOOD_GROUPS)[number];

export type PatientStatus = "active" | "inactive";

export interface Patient {
  id: string;
  patientId: string;
  firstName: string;
  lastName?: string;
  fullName: string;
  gender: PatientGender;
  dateOfBirth?: string;
  age?: number;
  mobile: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  emergencyContact?: string;
  bloodGroup?: PatientBloodGroup;
  status: PatientStatus;
  createdAt?: string;
  updatedAt?: string;
}

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

export interface PatientResponse {
  patient: Patient;
}

/** Documents removed from each patient-owned collection by a deletion. */
export interface DeletePatientCounts {
  bills: number;
  payments: number;
  samples: number;
  results: number;
  patient: number;
}

export interface DeletePatientResponse {
  patientId: string;
  fullName: string;
  deleted: DeletePatientCounts;
  /** Verified after the cleanup; every value is expected to be zero. */
  remaining: Omit<DeletePatientCounts, "payments">;
  summary: string;
}