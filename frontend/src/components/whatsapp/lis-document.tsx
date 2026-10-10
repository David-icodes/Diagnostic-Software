"use client";

import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { PrintPreview } from "@/components/test-result/lab-reprint";
import { InvoiceDocument } from "@/components/test-result/invoice-print-dialog";
import { reportStartsPage } from "@/lib/result-workflow";
import { fetchLisWhatsAppDocument } from "@/services/whatsapp-lis";
import { ApiError } from "@/lib/api";

/** Authenticated, expiring server job; reused clinical/invoice print layouts. */
export function LisDocument({ reviewId }: { reviewId: string }) {
  const query = useQuery({ queryKey: ["whatsapp-document", reviewId], queryFn: () => fetchLisWhatsAppDocument(reviewId),
    enabled: Boolean(reviewId), retry: false, gcTime: 0, refetchOnWindowFocus: false });
  if (!reviewId) return <p role="alert" data-whatsapp-document="error" data-http-status="400">Document review is missing.</p>;
  if (query.isError) return <p role="alert" data-whatsapp-document="error"
    data-http-status={query.error instanceof ApiError ? query.error.status : 0}>{query.error.message}</p>;
  if (!query.data) return <p role="status">Loading document…</p>;
  const data = query.data;
  return <main data-whatsapp-document="ready">
    {data.templateName === "lab_invoice_ready" ? <InvoiceDocument bill={data.bill} printedBy={data.printedBy} />
      : <div className="lis-print-document lis-result-print-document" data-print-mode={data.printMode} aria-label="Selected report preview">
        <div className="lis-clinical-page-watermark" aria-hidden="true"><Image src="/Main logo.png" alt="" width={1254} height={1254} unoptimized loading="eager" /></div>
        {data.reports.map((report, index) => <div key={report.item.testId} className="lis-result-print-part" data-new-page={reportStartsPage(data.printMode, index, report.item.departmentName, data.reports[index - 1]?.item.departmentName)}>
          <PrintPreview bill={data.bill} testName={report.item.testName} departmentName={report.item.departmentName}
            collectedOn={report.collectedOn} parameters={report.parameters} results={report.results}
            resolvedReferences={report.resolvedReferences} referenceResolutions={report.referenceResolutions}
            technician={data.technician} signatureNote={data.technician?.signatureNote}
            documentTitle={`${data.bill.billNumber}-${report.item.testCode}`} visible includeHeader onlyEntered={data.onlyEntered} />
        </div>)}
      </div>}
  </main>;
}
