"use client";
import Image from "next/image";
import {useQuery} from "@tanstack/react-query";
import {api} from "@/lib/api";
import type {LisWhatsAppDocument} from "@/services/whatsapp-lis";
import {PrintPreview} from "./lab-reprint";
import {reportStartsPage} from "@/lib/result-workflow";

export function BrowserReportDocument({jobId}:{jobId:string}) {
  const query=useQuery({queryKey:["browser-report-document",jobId],queryFn:()=>api.get<LisWhatsAppDocument&{includeHeader:boolean;letterhead:boolean}>(`/lab-test-results/render-data/${encodeURIComponent(jobId)}`),enabled:Boolean(jobId),retry:false,gcTime:0,refetchOnWindowFocus:false});
  if(!jobId||query.isError)return <p data-report-document="error">Authorized report preparation is unavailable.</p>;
  if(!query.data)return <p>Preparing report…</p>;
  const data=query.data;
  return <main data-report-document="ready"><div className="lis-print-document lis-result-print-document" data-print-mode={data.printMode}>
    <div className="lis-clinical-page-watermark" aria-hidden="true"><Image src="/Main logo.png" alt="" width={1254} height={1254} unoptimized loading="eager"/></div>
    {data.reports.map((report,index)=><div key={report.item.testId} className="lis-result-print-part" data-new-page={reportStartsPage(data.printMode,index,report.item.departmentName,data.reports[index-1]?.item.departmentName)}>
      <PrintPreview bill={data.bill} testName={report.item.testName} departmentName={report.item.departmentName} collectedOn={report.collectedOn} parameters={report.parameters} results={report.results} resolvedReferences={report.resolvedReferences} referenceResolutions={report.referenceResolutions} technician={data.technician} signatureNote={data.technician?.signatureNote} documentTitle={`${data.bill.billNumber}-${report.item.testCode}`} visible includeHeader={data.includeHeader} letterhead={data.letterhead} onlyEntered={data.onlyEntered}/>
    </div>)}
  </div></main>;
}
