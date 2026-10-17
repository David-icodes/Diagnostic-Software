"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { queryKeys } from "@/lib/query-keys";
import { FileUp } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { fetchResultUploads, uploadResultReport, downloadResultUpload, viewResultUpload } from "@/services/result-report-uploads";

export function ResultReportUpload({ billId, testId, testName, billNumber, patientLabel }: {
  billId: string; testId: string; testName: string; billNumber?:string; patientLabel?:string;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploading = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [header, setHeader] = useState<"header"|"none"|"letterhead">("header");
  const cache = useQueryClient();
  const key = ["result-report-uploads", billId, testId];
  const reports = useQuery({ queryKey: key, queryFn: () => fetchResultUploads(billId, testId), enabled: open, retry: false });
  const upload = useMutation({ mutationFn: (selected:File) => uploadResultReport(billId, testId, selected),
    onMutate: () => { setError(null); setSuccess(false); },
    onSuccess: async () => { setFile(null); if (fileInput.current) fileInput.current.value = ""; setSuccess(true); await Promise.all([cache.invalidateQueries({ queryKey: key }),cache.invalidateQueries({queryKey:queryKeys.testResults})]); },
    onError: (reason: Error) => setError(reason.message),
    onSettled: () => { uploading.current = false; },
  });
  const openPdf = async (id:string,print=false) => {
    setError(null);setDownloading(true);
    try { await viewResultUpload(billId,testId,id,print?header:undefined); }
    catch(reason) {setError(reason instanceof Error?reason.message:"Unable to open report.");}
    finally {setDownloading(false);}
  };
  return <div onClick={event => event.stopPropagation()}>
    <button type="button" className="lis-result-upload-button" aria-label={`Upload Reports for ${testName}`} title="Upload Reports" onClick={() => setOpen(true)}><FileUp /></button>
    {open && createPortal(<Dialog open centered title="Upload Reports" onOpenChange={next => { if (!uploading.current) setOpen(next); }}>
      <p className="mb-1 text-sm">Patient: {patientLabel ?? "Selected patient"}</p>
      <p className="mb-1 text-sm">Bill: {billNumber ?? billId}</p><p className="mb-3 text-sm">Test: {testName}</p>
      <label className="block text-sm">PDF report (up to 5 MB)<input ref={fileInput} type="file" accept="application/pdf,.pdf" disabled={upload.isPending}
        onChange={event => { setFile(event.target.files?.[0] ?? null); setSuccess(false); setError(null); }} className="my-2 block w-full" /></label>
      {error && <p role="alert">{error}</p>}{success && <p role="status">Report uploaded successfully.</p>}
      {reports.isPending && <p role="status">Loading uploaded reports…</p>}
      {reports.isError && <p role="alert">Unable to load reports: {reports.error.message} <button onClick={()=>void reports.refetch()}>Retry</button></p>}
      {(reports.data ?? []).some(report=>report.external) && <label className="my-2 block text-sm">External report print header
        <select aria-label="External report print header" value={header} onChange={event=>setHeader(event.target.value as typeof header)} disabled={downloading}>
          <option value="header">Including Header</option><option value="none">Without Header</option><option value="letterhead">Print On LetterHead</option>
        </select><span className="block text-xs">Include Header adds stationery above the original first page without shrinking its content. The derived first page is taller; use Original size or a suitable paper size when printing. Stored PDFs are never changed. Printing does not submit or approve in-house results.</span>
      </label>}
      {(reports.data ?? []).map((report,index) => <div key={report.id} className="my-2 flex flex-wrap items-center gap-2 border-t py-2">
        <span className="break-all text-sm">{report.fileName}{index === 0 ? " — Current report" : " — Previous version"}</span>
        <Button variant="outline" size="sm" disabled={downloading || upload.isPending} onClick={()=>void openPdf(report.id)}>View PDF</Button>
        <Button variant="outline" size="sm" disabled={downloading || upload.isPending} onClick={async()=>{
          setError(null);setDownloading(true);try {await downloadResultUpload(billId,testId,report);} catch(reason){setError(reason instanceof Error?reason.message:"Unable to download report.");}finally{setDownloading(false);}
        }}>Download original</Button>
        {report.external && <Button variant="outline" size="sm" disabled={downloading || upload.isPending} onClick={()=>void openPdf(report.id,true)}>Review and print external report</Button>}
      </div>)}
      {downloading && <p role="status">Preparing PDF…</p>}
      <div className="mt-3 flex justify-end gap-2"><Button disabled={!file || upload.isPending || reports.isError} onClick={()=>{
        if(uploading.current || !file)return;uploading.current=true;upload.mutate(file);
      }}>{upload.isPending ? "Uploading…" : "Upload"}</Button><Button variant="outline" disabled={upload.isPending || downloading} onClick={()=>setOpen(false)}>Close</Button></div>
    </Dialog>, document.body)}
  </div>;
}
