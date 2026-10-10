import type { SampleContext } from "./lab-workflows.ts";

export interface ResultBillFilters {
  mode: "today" | "criteria";
  today: string;
  includeClients: boolean;
  fromDate?: string;
  toDate?: string;
  billNumber?: string;
  patientName?: string;
  quickSearch?: string;
}

/** Selection context never silently narrows a Today list to one bill. */
export function resultBillParams(filters: ResultBillFilters) {
  const search = filters.mode === "today" ? filters.quickSearch?.trim() :
    filters.billNumber?.trim() || filters.patientName?.trim() || filters.quickSearch?.trim();
  return {
    status: "generated", limit: 100,
    ...(!filters.includeClients ? { billType: "osp" } : {}),
    ...(filters.mode === "today" ? { fromDate: filters.today, toDate: filters.today } : {
      ...(filters.fromDate ? { fromDate: filters.fromDate } : {}),
      ...(filters.toDate ? { toDate: filters.toDate } : {}),
    }),
    ...(search ? { search } : {}),
  };
}

export function initialResultBillParams(today: string, context?: SampleContext) {
  const saved = context?.returnFilters;
  return resultBillParams({ mode: saved?.mode ?? (context ? "criteria" : "today"), today,
    includeClients: saved?.includeClients ?? true,
    fromDate: saved?.fromDate ?? today, toDate: saved?.toDate ?? today,
    billNumber: saved?.billNumber ?? context?.billNumber, patientName: saved?.patientName });
}

/** Consume the API's pagination rather than silently dropping bills after page 1. */
export async function allResultBillPages<T>(load: (page: number) => Promise<{ data: T[]; pagination: { totalPages: number } }>): Promise<T[]> {
  const first = await load(1);
  const rows = [...first.data];
  for (let page = 2; page <= first.pagination.totalPages; page++) rows.push(...(await load(page)).data);
  return rows;
}
