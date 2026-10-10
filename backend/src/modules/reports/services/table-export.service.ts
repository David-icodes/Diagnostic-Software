import { z } from "zod";
import { chromium } from "playwright";
import { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, PageOrientation } from "docx";
import { ApiError } from "../../../utils/api-error";
import { pdfFailure } from "../../whatsapp/lis-pdf-diagnostics";

export const tableExportSchema = z.object({
  format: z.enum(["pdf", "word"]), title: z.string().trim().min(1).max(160),
  criteria: z.string().max(3000).optional(),
  headers: z.array(z.string().max(160)).min(1).max(30),
  rows: z.array(z.array(z.string().max(10000))).min(1).max(10000),
}).strict().superRefine((v,c) => { if (v.rows.some((row) => row.length !== v.headers.length)) c.addIssue({ code: "custom", message: "Every row must match the column headings" }); });
export type TableExportInput = z.infer<typeof tableExportSchema>;
const escape = (v: string) => v.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
export function tableColumnWidths(headers: string[]): number[] {
  const weights = headers.map((header) => {
    const name = header.toLowerCase();
    if (/^s\s*no$/.test(name)) return 0.6;
    if (/test|investigation|address/.test(name)) return 3;
    if (/bill no|pat id|patient id|bill date/.test(name)) return 1.6;
    if (/name|doctor/.test(name)) return 1.4;
    return 1.1;
  });
  const total = weights.reduce((sum, value) => sum + value, 0);
  return weights.map((value) => value * 100 / total);
}
export function tableExportHtml(input: TableExportInput): string {
  const widths = tableColumnWidths(input.headers);
  const wide = input.headers.length > 12;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4 landscape; margin: 10mm; @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 8pt Arial; } }
    body { font: ${wide ? 7 : 9}pt Arial,sans-serif; color: #111; } h1 { font-size: 14pt; } p { font-size: 8pt; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; } th,td { border: .5pt solid #777; padding: ${wide ? 1 : 2}mm; overflow-wrap: anywhere; white-space: pre-wrap; vertical-align: top; }
    th { background: #e9edf3; text-align: left; } thead { display: table-header-group; } tr { break-inside: avoid; }
    </style></head><body><h1>${escape(input.title)}</h1><p>${escape(input.criteria ?? "")}</p><p>Records: ${input.rows.length}</p>
    <table><colgroup>${widths.map(width => `<col style="width:${width.toFixed(3)}%">`).join("")}</colgroup><thead><tr>${input.headers.map(h => `<th>${escape(h)}</th>`).join("")}</tr></thead><tbody>${input.rows.map(row => `<tr>${row.map(v => `<td>${escape(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`;
}
let active = 0;
export async function exportTable(input: TableExportInput): Promise<Buffer> {
  if (input.format === "word") {
    const widths = tableColumnWidths(input.headers);
    const cell = (text: string, index: number) => new TableCell({ children: text.split("\n").map(line => new Paragraph(line)), width: { size: widths[index], type: WidthType.PERCENTAGE } });
    const document = new Document({ styles: { paragraphStyles: [{ id: "Title", name: "Title", basedOn: "Normal", run: { size: 28, bold: true }, paragraph: { spacing: { after: 120 } } }], default: { document: { run: { size: input.headers.length > 12 ? 14 : 18, font: "Arial" } } } }, sections: [{ properties: { page: { size: { orientation: PageOrientation.LANDSCAPE, width: 11906, height: 16838 }, margin: { top: 567, bottom: 567, left: 567, right: 567 } } }, children: [
      new Paragraph({ text: input.title, heading: "Title" }), new Paragraph(input.criteria ?? ""), new Paragraph(`Records: ${input.rows.length}`),
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ tableHeader: true, children: input.headers.map(cell) }), ...input.rows.map(row => new TableRow({ cantSplit: true, children: row.map(cell) }))] }),
    ] }] });
    return Packer.toBuffer(document);
  }
  if (active >= 2) throw new ApiError(429, "PDF exports are being prepared. Try again shortly.");
  active++; let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    await context.route("**/*", route => route.abort()); // Only escaped text; never fetch arbitrary resources.
    const page = await context.newPage();
    await page.setContent(tableExportHtml(input));
    return await page.pdf({ format: "A4", landscape: true, preferCSSPageSize: true, printBackground: true });
  } catch (error) {
    const diagnostic = pdfFailure("table export", error);
    console.error("[Report PDF export]", { code: diagnostic.code, detail: diagnostic.detail });
    throw new ApiError(503, diagnostic.code === "BROWSER_RUNTIME_MISSING" ? "PDF export requires the backend Chromium runtime. Ask the administrator to run npm run pdf:install on the backend host." : "Unable to generate the PDF export. Retry or ask the administrator to check the renderer logs.");
  } finally { active--; await browser?.close().catch(() => undefined); }
}
