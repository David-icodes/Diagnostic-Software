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