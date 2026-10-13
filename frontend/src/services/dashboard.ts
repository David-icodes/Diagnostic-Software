import { api } from "@/lib/api";
import type { DashboardSummary, DueBill, TodayBill } from "@/types/dashboard";

export function fetchDashboardSummary() {
  return api.get<DashboardSummary>("/dashboard/summary");
}

export function fetchTodayBills() {
  return api.get<TodayBill[]>("/dashboard/today-bills");
}

export function fetchDueBills() {
  return api.get<DueBill[]>("/dashboard/due-bills");
}
export function fetchOutstandingBills(page=1){return api.get<{items:(DueBill & {billDate:string})[];totalDue:number;pagination:{page:number;limit:number;total:number;totalPages:number}}>(`/dashboard/outstanding-bills?page=${page}&limit=20`);}
