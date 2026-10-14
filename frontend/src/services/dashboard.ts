import { api } from "@/lib/api";
import type { DashboardSummary, DueBill, TodayBill } from "@/types/dashboard";

export function fetchDashboardSummary() {
  return api.get<DashboardSummary>("/dashboard/summary");
}

export function fetchTodayBills(before?: string) {
  const query = new URLSearchParams({ limit: "30" });
  if (before) query.set("before", before);
  return api.get<TodayBill[]>(`/dashboard/today-bills?${query}`);
}

export function fetchDueBills() {
  return api.get<DueBill[]>("/dashboard/due-bills");
}
export function fetchOutstandingBills(before?:string){const query=new URLSearchParams({cursor:"true",limit:"20"});if(before)query.set("before",before);return api.get<{items:(DueBill & {billDate:string})[];nextCursor?:string;totalDue:number;pagination:{total:number;totalPages:number;limit:number;page:number}}>(`/dashboard/outstanding-bills?${query}`);}
