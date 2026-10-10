export interface DashboardSummary {
  labBills: number;
  completedTests: number;
  pendingTests: number;
  date: string;
}

export interface TodayBill {
  id: string;
  billNo: string;
  patientId: string;
  patientName: string;
  age: string;
  gender: string;
  completed: boolean;
}

export interface DueBill {
  id: string;
  billNo: string;
  patientId: string;
  patientName: string;
  net: number;
  paid: number;
  due: number;
}
