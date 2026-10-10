export interface ExportPage<T> { data: T[]; pagination: { total: number; totalPages: number } }
/** Keep the existing small export response; page through larger filtered datasets. */
export async function fullReportRows<T>(initial: ExportPage<T>, fetchPage: (page: number) => Promise<ExportPage<T>>): Promise<T[]> {
  if (initial.data.length >= initial.pagination.total) return initial.data;
  if (initial.pagination.total > 10000) throw new Error("This export is too large. Select a smaller date range.");
  const all: T[] = [];
  for (let page = 1; ; page++) {
    const part = await fetchPage(page);
    if (part.pagination.total !== initial.pagination.total) throw new Error("Report data changed during export. Please retry.");
    all.push(...part.data);
    if (page >= part.pagination.totalPages) break;
    if (page >= 100 || !part.data.length) throw new Error("The complete filtered report could not be loaded. Please retry.");
  }
  if (all.length !== initial.pagination.total) throw new Error("The complete filtered report could not be loaded. Please retry.");
  return all;
}
