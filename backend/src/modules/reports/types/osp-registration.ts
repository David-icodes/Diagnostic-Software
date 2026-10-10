export interface OspRegistrationReportRow {
  /** Patient document id — the target used by the delete action. */
  id: string;
  patientId: string;
  patientName: string;
  registrationDate: string;
  dateOfBirth: string | null;
  age: number | null;
  gender: string;
  mobile: string;
  address: string;
  /** Bill / test / package description built from the patient's registered bills. */
  billFor: string;
}

export interface OspRegistrationSummary {
  totalPatients: number;
  totalBills: number;
}

export interface OspRegistrationResult {
  data: OspRegistrationReportRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  summary: OspRegistrationSummary;
}