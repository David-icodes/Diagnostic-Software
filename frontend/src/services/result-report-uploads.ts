import { api, ApiError } from "@/lib/api";

export interface UploadedResultReport { id: string; fileName: string; size: number; createdAt: string }
const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1";
const query = (billId: string, testId: string) => new URLSearchParams({ billId, testId });

export function fetchResultUploads(billId: string, testId: string) {
  return api.get<UploadedResultReport[]>(`/lab-test-results/report-uploads?${query(billId, testId)}`);
}
export async function uploadResultReport(billId: string, testId: string, file: File): Promise<UploadedResultReport> {
  if (!/\.pdf$/i.test(file.name) || !file.size || file.size > 5 * 1024 * 1024) throw new Error("Select a PDF report up to 5 MB.");
  const params = query(billId, testId); params.set("fileName", file.name);
  let response: Response;
  try { response = await fetch(`${base}/lab-test-results/report-uploads?${params}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/pdf" }, body: file }); }
  catch { throw new Error("Unable to reach the server. Please check your connection."); }
  const envelope = await response.json().catch(() => null);
  if (!response.ok || !envelope?.success || !envelope.data) throw new ApiError(envelope?.message || "Unable to upload report.", response.status);
  return envelope.data;
}
export async function downloadResultUpload(billId: string, testId: string, report: UploadedResultReport) {
  const response = await fetch(`${base}/lab-test-results/report-uploads/${encodeURIComponent(report.id)}?${query(billId, testId)}`, { credentials: "include" });
  if (!response.ok) {
    const envelope = await response.json().catch(() => null);
    throw new ApiError(envelope?.message || "Unable to download report.", response.status);
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a"); link.href = url; link.download = report.fileName;
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
