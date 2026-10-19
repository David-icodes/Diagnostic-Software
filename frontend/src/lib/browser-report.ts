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
  return openAuthorizedReportPdf(browserReportUrl(base, options));
}

export async function openAuthorizedReportPdf(url: string) {
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
    objectUrl = URL.createObjectURL(pdf);
    const tab = window.open(objectUrl, "_blank");
    // Browsers may block a new tab after a long request. Open the ready PDF in
    // this tab instead, without making the user click Generate a second time.
    if (!tab) { window.location.assign(objectUrl); return; }
    tab.opener = null;
    performance.mark("lis-report-viewer-handoff");
    const retainedUrl = objectUrl;
    const release = () => { URL.revokeObjectURL(retainedUrl); window.clearInterval(timer); window.removeEventListener("pagehide", release); };
    const timer = window.setInterval(() => { if (tab.closed) release(); }, 10000);
    window.addEventListener("pagehide", release, { once: true });
  } catch (error) {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    if (controller.signal.aborted) throw new Error("Report generation timed out. Please retry.");
    throw error;
  } finally { window.clearTimeout(timeout); }
}
