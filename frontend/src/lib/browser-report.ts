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

/** Reserve the tab in the click event; populate it only after an authorized PDF succeeds. */
export async function generateBrowserReport(options: ReportOptions) {
  const tab = window.open("about:blank", "_blank");
  if (!tab) throw new Error("Allow pop-ups for this application, then generate the report again.");
  tab.opener = null;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 90000);
  let objectUrl: string | undefined;
  try {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1";
    const response = await fetch(browserReportUrl(base, options), { credentials: "include", signal: controller.signal });
    const pdf = await validatedReportPdf(response);
    if (tab.closed) return;
    objectUrl = URL.createObjectURL(pdf);
    tab.location.replace(objectUrl);
    // Keep the native viewer's download/print functional for the lifetime of its tab.
    const retainedUrl = objectUrl;
    const release = () => { URL.revokeObjectURL(retainedUrl); window.clearInterval(timer); window.removeEventListener("pagehide", release); };
    const timer = window.setInterval(() => { if (tab.closed) release(); }, 10000);
    window.addEventListener("pagehide", release, { once: true });
  } catch (error) {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    tab.close();
    if (controller.signal.aborted) throw new Error("Report generation timed out. Please retry.");
    throw error;
  } finally { window.clearTimeout(timeout); }
}
