import { BrowserReportDocument } from "@/components/test-result/browser-report-document";
export default async function ReportDocumentPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const query=await searchParams;
  return <BrowserReportDocument jobId={typeof query.jobId==="string"?query.jobId:""}/>;
}
