import { api } from "@/lib/api";
export function formatCriteriaDate(value: string | undefined): string {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

export function reportCsvName(prefix: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${prefix}-${stamp}.csv`;
}

export function downloadCsv(filename: string, headers: string[], rows: string[][]): void {
  const escape = (value: string) => {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };
  const content = [headers, ...rows]
    .map((row) => row.map(escape).join(","))
    .join("\r\n");
  const blob = new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
export type ReportExportFormat = "excel" | "pdf" | "word";
export async function downloadReport(filename: string, headers: string[], rows: string[][], format: ReportExportFormat = "excel", criteria = ""): Promise<void> {
  if (!rows.length) throw new Error("No records match the selected export criteria.");
  if (format === "excel") { downloadCsv(filename, headers, rows); return; }
  const title = filename.replace(/-\d{4}-\d{2}-\d{2}\.csv$/, "").replaceAll("-", " ");
  const payload = { format, title, criteria, headers, rows };
  if (new TextEncoder().encode(JSON.stringify(payload)).length > 900000) throw new Error("This export is too large. Select a smaller date range.");
  const result = await api.post<{ content: string }>("/reports/table-export", payload);
  const bytes = Uint8Array.from(atob(result.content), (char) => char.charCodeAt(0));
  const blob = new Blob([bytes], { type: format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  const url = URL.createObjectURL(blob); const link = document.createElement("a");
  link.href = url; link.download = filename.replace(/\.csv$/, format === "pdf" ? ".pdf" : ".docx");
  document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}
