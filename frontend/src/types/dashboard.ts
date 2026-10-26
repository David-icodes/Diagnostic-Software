export interface DashboardSummary {
  labBills: number;
  completedTests: number;
  pendingTests: number;
  /** Legacy backend alias for pending bills. */
  pendingTestCount: number;
  date: string;
}

export interface TodayBill {
  patientRecordId?:string;
  vendorName?: string;
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
