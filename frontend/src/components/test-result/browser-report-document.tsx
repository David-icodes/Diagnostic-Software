"use client";
import Image from "next/image";
import {InvoiceDocument} from "./invoice-print-dialog";
import {useQuery} from "@tanstack/react-query";
import {api} from "@/lib/api";
import type {LisWhatsAppDocument} from "@/services/whatsapp-lis";
import {ReportLetterhead} from "./report-letterhead";
import {PrintPreview} from "./lab-reprint";
import {reportStartsPage} from "@/lib/result-workflow";
import {groupDepartmentReports} from "@/lib/report-departments";

export type BrowserReportData=LisWhatsAppDocument&{includeHeader:boolean;letterhead:boolean;invoice?:boolean;externalReport?:{testName:string;fileName:string}};

export function BrowserReportDocument({jobId}:{jobId:string}) {
  const query=useQuery({queryKey:["browser-report-document",jobId],queryFn:()=>api.get<BrowserReportData>(`/lab-test-results/render-data/${encodeURIComponent(jobId)}`),enabled:Boolean(jobId),retry:false,gcTime:0,refetchOnWindowFocus:false});
  if(!jobId||query.isError)return <p data-report-document="error">Authorized report preparation is unavailable.</p>;
  if(!query.data)return <p>Preparing report…</p>;
  return <ReportDocumentContent data={query.data}/>;
}

/** Presentation of the authorized snapshot; shared by individual and Print All. */
export function ReportDocumentContent({data}:{data:BrowserReportData}) {
  if(data.invoice)return <main data-report-document="ready"><InvoiceDocument bill={data.bill} printedBy={data.printedBy} includeHeader={data.includeHeader}/></main>;
  if(data.externalReport) {
    return <main data-report-document="ready" className="lis-print-document lis-result-print-document">
      <section className="lis-report-paper mx-auto w-[188mm] bg-white font-serif text-black">
        <ReportLetterhead includeHeader={data.includeHeader} letterhead={data.letterhead}/>
      </section>
    </main>;
  }

  return <main data-report-document="ready"><div className="lis-print-document lis-result-print-document" data-print-mode={data.printMode}>
    <div className="lis-clinical-page-watermark" aria-hidden="true"><Image src="/report-watermark-optimized.png" alt="" width={600} height={600} unoptimized loading="eager"/></div>
    {data.printMode === "department" ? groupDepartmentReports(data.reports).map((group,index)=>{
      const first=group.reports[0];
      return <div key={group.key} className="lis-result-print-part" data-new-page={index>0} data-report-department={group.name}>
        <PrintPreview bill={data.bill} testName="Selected investigations" departmentName={group.name} collectedOn={first.collectedOn} parameters={first.parameters} results={first.results} technician={data.technician} signatureNote={data.technician?.signatureNote} documentTitle={`${data.bill.billNumber}-department-${index+1}`} visible includeHeader={data.includeHeader} letterhead={data.letterhead} onlyEntered={data.onlyEntered}
          reportTests={group.reports.map(report=>({testName:report.item.testName,collectedOn:report.collectedOn,parameters:report.parameters,results:report.results,resolvedReferences:report.resolvedReferences,referenceResolutions:report.referenceResolutions}))}/>
      </div>;
    }) : data.reports.map((report,index)=><div key={report.item.testId} className="lis-result-print-part" data-new-page={reportStartsPage(data.printMode,index,report.item.departmentName,data.reports[index-1]?.item.departmentName)}>
      <PrintPreview bill={data.bill} testName={report.item.testName} departmentName={report.item.departmentName} collectedOn={report.collectedOn} parameters={report.parameters} results={report.results} resolvedReferences={report.resolvedReferences} referenceResolutions={report.referenceResolutions} technician={data.technician} signatureNote={data.technician?.signatureNote} documentTitle={`${data.bill.billNumber}-${report.item.testCode}`} visible includeHeader={data.includeHeader} letterhead={data.letterhead} onlyEntered={data.onlyEntered}/>
    </div>)}
  </div></main>;
}
