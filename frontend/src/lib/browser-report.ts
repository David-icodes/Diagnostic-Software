interface ReportOptions {billId:string;testIds:string[];technicianId?:string;onlyEntered?:boolean;includeHeader?:boolean;letterhead?:boolean;printMode?:string;download?:boolean}
export function browserReportUrl(base:string,options:ReportOptions) {
  const query=new URLSearchParams({billId:options.billId,testIds:options.testIds.join(","),onlyEntered:String(Boolean(options.onlyEntered)),includeHeader:String(Boolean(options.includeHeader)),letterhead:String(Boolean(options.letterhead)),printMode:options.printMode??"continuous",download:String(Boolean(options.download))});
  if(options.technicianId)query.set("technicianId",options.technicianId);
  return `${base.replace(/\/$/,"")}/lab-test-results/report.pdf?${query}`;
}
/** Reject error/HTML responses before handing bytes to the native viewer. */
export async function validatedReportPdf(response: Response): Promise<Blob> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(typeof body?.message === "string" ? body.message : "Report generation failed. Please retry.");
  }
  if (!response.headers.get("content-type")?.includes("application/pdf")) throw new Error("The server did not return a PDF report.");
  const blob = await response.blob();
  if (await blob.slice(0, 5).text() !== "%PDF-") throw new Error("The generated report is not a valid PDF.");
  return blob;
}

/** Keep progress on the current screen; open only a finished, validated PDF. */
export async function generateBrowserReport(options: ReportOptions) {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1";
  return openAuthorizedReportPdf(browserReportUrl(base, options), options.download);
}

export async function openAuthorizedReportPdf(url: string, download = false) {
  performance.mark("lis-report-request-start");
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 90000);
  let objectUrl: string | undefined;
  try {
    const response = await fetch(url, { credentials: "include", signal: controller.signal });
    performance.mark("lis-report-response-headers");
    const pdf = await validatedReportPdf(response);
    performance.mark("lis-report-bytes-ready");
    performance.measure("lis-report-request", "lis-report-request-start", "lis-report-response-headers");
    performance.measure("lis-report-download", "lis-report-response-headers", "lis-report-bytes-ready");
    if (download || new URL(url, "http://localhost").searchParams.get("download") === "true") {
      objectUrl = URL.createObjectURL(pdf);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = reportDownloadFilename(response.headers.get("content-disposition"));
      link.click();
      const retainedUrl = objectUrl;
      window.setTimeout(() => URL.revokeObjectURL(retainedUrl), 60000);
      return;
    }
    // Native PDF viewers derive Save As from Content-Disposition only when the
    // document has its authenticated server URL, not a generated blob UUID.
    // The viewer's fresh request repeats authorization and report-freshness checks.
    const tab = window.open(url, "_blank");
    if (!tab) { window.location.assign(url); return; }
    tab.opener = null;
    performance.mark("lis-report-viewer-handoff");
  } catch (error) {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    if (controller.signal.aborted) throw new Error("Report generation timed out. Please retry.");
    throw error;
  } finally { window.clearTimeout(timeout); }
}

/** Use only the server-authorized document name, never a path from a header. */
export function reportDownloadFilename(disposition: string | null): string {
  const encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = disposition?.match(/filename="?([^";]+)/i)?.[1];
  let name = "report.pdf";
  try { name = encoded ? decodeURIComponent(encoded) : plain ?? name; } catch { /* safe fallback */ }
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 150).replace(/(?:\.pdf)?$/i, ".pdf");
}
