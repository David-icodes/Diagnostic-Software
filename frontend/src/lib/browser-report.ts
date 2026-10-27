import {browserSessionHeaders} from "./session-scope.ts";
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
    const response = await fetch(url, { credentials: "include", headers:browserSessionHeaders(), signal: controller.signal });
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
      link.target = "_blank"; link.rel = "noopener";
      document.body?.appendChild(link);
      link.click(); link.remove?.();
      const retainedUrl = objectUrl;
      window.setTimeout(() => URL.revokeObjectURL(retainedUrl), 60000);
      return;
    }
    // Use the already-authorized bytes. A second top-level API navigation can
    // omit a cross-site session cookie and must never be used as the print handoff.
    objectUrl = URL.createObjectURL(pdf);
    const viewerUrl = URL.createObjectURL(new Blob([reportViewerHtml(objectUrl, reportDownloadFilename(response.headers.get("content-disposition")))], {type:"text/html"}));
    const tab = window.open(viewerUrl, "_blank");
    if (!tab) { window.location.assign(viewerUrl); return; }
    tab.opener = null;
    const retainedPdf = objectUrl;
    const cleanup = window.setInterval(() => {
      if (tab.closed) { URL.revokeObjectURL(retainedPdf); URL.revokeObjectURL(viewerUrl); window.clearInterval(cleanup); }
    }, 1000);
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

/** Self-contained, memory-only viewer. Names are escaped; no scripts or URLs come from report content. */
export function reportViewerHtml(pdfUrl: string, filename: string): string {
  if (!pdfUrl.startsWith("blob:")) throw new Error("Invalid local PDF URL");
  const escape = (text:string) => text.replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]!));
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src blob:; style-src 'unsafe-inline'; script-src 'sha256-9w3OC/w3ds/5OatgjB7R3wVIf21CnZcEYwHP4vayIoE='; base-uri 'none'; form-action 'none'"><title>${escape(filename)}</title><style>body{margin:0;font:14px Arial;background:#333;color:white}header{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px}header span{overflow-wrap:anywhere}a,button{background:white;color:#111;border:0;padding:8px 16px;text-decoration:none;border-radius:4px;cursor:pointer}iframe{display:block;border:0;width:100%;height:calc(100vh - 54px)}</style></head><body><header><span>${escape(filename)}</span><button id="print" type="button">Print</button><a target="_blank" rel="noopener" href="${escape(pdfUrl)}" download="${escape(filename)}">Download</a></header><iframe id="pdf" title="Report PDF" src="${escape(pdfUrl)}"></iframe><script>document.getElementById('print').addEventListener('click',function(){var frame=document.getElementById('pdf');frame.contentWindow.focus();frame.contentWindow.print();});</script></body></html>`;
}
