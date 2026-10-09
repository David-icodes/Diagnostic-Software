"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FileUp } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { fetchResultUploads, uploadResultReport, downloadResultUpload } from "@/services/result-report-uploads";

export function ResultReportUpload({ billId, testId, testName }: { billId: string; testId: string; testName: string }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const cache = useQueryClient();
  const key = ["result-report-uploads", billId, testId];
  const reports = useQuery({ queryKey: key, queryFn: () => fetchResultUploads(billId, testId), enabled: open, retry: false });
  const upload = useMutation({ mutationFn: () => {
    if (!file) throw new Error("Select a PDF report.");
    return uploadResultReport(billId, testId, file);
  }, onMutate: () => { setError(null); setSuccess(false); },
  onSuccess: async () => { setFile(null); if (fileInput.current) fileInput.current.value = ""; setSuccess(true); await cache.invalidateQueries({ queryKey: key }); },
  onError: (reason: Error) => setError(reason.message) });

  return <div onClick={(event) => event.stopPropagation()}>
    <button type="button" className="lis-result-upload-button" aria-label={`Upload Reports for ${testName}`} title="Upload Reports" onClick={() => setOpen(true)}><FileUp /></button>
    {open && createPortal(<Dialog open centered title="Upload Reports" onOpenChange={(next) => { if (!upload.isPending) setOpen(next); }}>
      <p className="text-sm mb-3">{testName}</p>
      <label className="block text-sm">PDF report (up to 5 MB)<input ref={fileInput} type="file" accept="application/pdf,.pdf" disabled={upload.isPending}
        onChange={(event) => { setFile(event.target.files?.[0] ?? null); setSuccess(false); setError(null); }} className="block w-full my-2" /></label>
      {error && <p role="alert">{error}</p>}{success && <p role="status">Report uploaded successfully.</p>}
      {reports.isPending && <p role="status">Loading uploaded reports…</p>}
      {reports.isError && <p role="alert">Unable to load reports: {reports.error.message}</p>}
      {(reports.data ?? []).map((report) => <p key={report.id}><button type="button" disabled={downloading || upload.isPending} className="underline text-sm" onClick={async () => {
        setError(null); setDownloading(true); try { await downloadResultUpload(billId, testId, report); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to download report."); } finally { setDownloading(false); }
      }}>{report.fileName}</button></p>)}
      <div className="flex justify-end gap-2 mt-3"><Button disabled={!file || upload.isPending || reports.isError} onClick={() => upload.mutate()}>{upload.isPending ? "Uploading…" : "Upload"}</Button><Button variant="outline" disabled={upload.isPending} onClick={() => setOpen(false)}>Close</Button></div>
    </Dialog>, document.body)}
  </div>;
}
