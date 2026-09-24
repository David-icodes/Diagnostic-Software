export interface DashboardSummary {
  labBills: number;
  completedTests: number;
  pendingTests: number;
  date: string;
}

export interface TodayBill {
  billNo: string;
  patientId: string;
  patientName: string;
  age: string;
  gender: "Male" | "Female";
}

export interface DueBill {
  billNo: string;
  patientId: string;
  patientName: string;
  net: number;
  paid: number;
  due: number;
}