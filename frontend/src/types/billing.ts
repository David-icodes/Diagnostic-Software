export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string;
  type?: string;
  active: boolean;
  sortOrder: number;
  testCount: number;
}

export interface DepartmentResponse {
  department: Department;
}

export type LabTestResultMode =
  | "PARAMETER_BASED"
  | "TEMPLATE_BASED"
  | "SIMPLE_RESULT"
  | "CALCULATED";

export interface LabTest {
  id: string;
  testCode: string;
  testName: string;
  shortName: string;
  departmentId: string;
  description?: string;
  sampleType?: string;
  containerType?: string;
  testType?: string;
  price: number;
  priceIp?: number;
  priceEr?: number;
  active: boolean;
  resultMode: LabTestResultMode;
  createdAt?: string;
  updatedAt?: string;
}

export interface LabTestListResult {
  items: LabTest[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface LabTestResponse {
  test: LabTest;
}

export interface Doctor {
  id: string;
  name: string;
  qualification?: string;
  specialization?: string;
  mobile?: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface DoctorResponse {
  doctor: Doctor;
}

export const PAYMENT_MODES = [
  "cash",
  "upi",
  "card",
  "bank_transfer",
  "other",
] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const PATIENT_TYPES = [
  "osp",
  "op",
  "ip",
  "emergency",
  "corporate",
] as const;
export type PatientType = (typeof PATIENT_TYPES)[number];

export type BillStatus = "draft" | "generated" | "cancelled";

export type BillType = "osp" | "vendor";

export const BILL_TYPES: BillType[] = ["osp", "vendor"];

export interface LabClient {
  id: string;
  clientCode: string;
  name: string;
  contactPerson?: string;
  mobile?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ClientResponse {
  client: LabClient;
}

export interface LabBillPayment {
  id: string;
  amount: number;
  discountAmount?: number;
  paymentMode: PaymentMode;
  comments?: string;
  collectedAt: string;
  collectedBy: string;
}

export interface BillPatient {
  id: string;
  patientId: string;
  fullName: string;
  gender: string;
  age?: number;
  mobile: string;
}

export interface BillDoctor {
  id: string;
  name: string;
  qualification?: string;
  specialization?: string;
}

export interface BillItem {
  testId: string;
  testCode: string;
  testName: string;
  departmentId: string;
  departmentName: string;
  unitPrice: number;
  quantity: number;
  total: number;
  outsideLabId?: string | null;
  outsideLabName?: string;
  sentOutAt?: string | null;
}

export interface LabBill {
  id: string;
  billNumber: string;
  billType?: BillType;
  patientType: PatientType;
  patientId: string | BillPatient;
  clientId?: string | LabClient;
  clientName?: string;
  referringDoctorId?: string | BillDoctor;
  doctorName?: string;
  items: BillItem[];
  totalAmount: number;
  discountPercent: number;
  discountAmount: number;
  netAmount: number;
  paidAmount: number;
  dueAmount: number;
  paymentMode: PaymentMode;
  comments?: string;
  displayComments?: string;
  status: BillStatus;
  payments?: LabBillPayment[];
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationRemarks?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LabBillResponse {
  bill: LabBill;
}

export interface CancelLabBillRequest {
  cancellationRemarks: string;
}

export interface CollectDueRequest {
  amount: number;
  discountAmount?: number;
  paymentMode: PaymentMode;
  comments?: string;
}

export interface BillItemsRequest {
  out?: boolean;
  outsideLabId?: string | null;
  testId: string;
  quantity: number;
}

export interface CreateLabBillRequest {
  patientId: string;
  patientType: PatientType;
  billType?: BillType;
  clientId?: string;
  referringDoctorId?: string;
  items: BillItemsRequest[];
  discountPercent: number;
  discountAmount?: number;
  paidAmount: number;
  paymentMode: PaymentMode;
  comments?: string;
  displayComments?: string;
  status: BillStatus;
}

export interface ModifyLabBillRequest {
  referringDoctorId?: string;
  items: BillItemsRequest[];
  discountPercent: number;
  paymentMode: PaymentMode;
  comments?: string;
  displayComments?: string;
}