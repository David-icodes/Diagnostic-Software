"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PrintPreview } from "@/components/test-result/lab-reprint";
import { fetchBillResultEntry, fetchLabSamples, fetchTestResults, checkResultReportEligibility } from "@/services/test-results";
import { requireReportEligibility, reportStartsPage, type ResultPrintMode } from "@/lib/result-workflow";
import { orderedPrintIds } from "@/lib/lab-workflows";
import { printDocument } from "@/lib/print-document";
import type { LabBill } from "@/types/billing";
import type { LabTechnician } from "@/types/test-result";

export function ResultPrintDialog({ bill, testIds, technician, onClose, initialOnlyEntered = false, printMode = "continuous" }: {
  bill: LabBill; testIds: string[]; technician: LabTechnician | null; onClose: () => void;
  initialOnlyEntered?: boolean; printMode?: ResultPrintMode;
}) {
  const [includeHeader, setIncludeHeader] = useState(false);
  const [letterhead, setLetterhead] = useState(false);
  const [onlyEntered, setOnlyEntered] = useState(initialOnlyEntered);
  const [checking, setChecking] = useState(false);
  const [preview, setPreview] = useState(false);
  const documentRef = useRef<HTMLDivElement>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  // Intersect with the selected bill and keep its order. Do not use test names.
  const ids = orderedPrintIds(bill.items, Object.fromEntries(testIds.map((id) => [id, true])));
  const reports = useQuery({
    queryKey: ["test-results", "print", bill.id, ids],
    queryFn: async () => {
      if (!bill.patientId || typeof bill.patientId !== "object") throw new Error("Patient information is not available for this bill.");
      requireReportEligibility(await checkResultReportEligibility(bill.id, ids), bill.id, bill.patientId.id, ids);
      const [entry, results, samples] = await Promise.all([
        fetchBillResultEntry(bill.id),
        Promise.all(ids.map((id) => fetchTestResults(bill.id, id))),
        fetchLabSamples({ mode: "criteria", billNumber: bill.billNumber }),
      ]);
      if (entry.billId !== bill.id) throw new Error("The report does not belong to the selected bill.");
      if (entry.patientId !== bill.patientId.id) throw new Error("The report does not belong to the selected patient.");
      return ids.map((id, index) => {
        const test = entry.tests.find((row) => row.testId === id);
        const item = bill.items.find((row) => row.testId === id);
        if (!test?.testLinked || !item) throw new Error("An ordered test is not linked to its report definition.");
        if (results[index].some((result) => result.billId !== bill.id || result.testId !== id || result.patientId !== entry.patientId)) {
          throw new Error("A result does not belong to the selected bill and test.");
        }
        return {
          item,
          parameters: test.parameters.map((parameter) => ({
            ...parameter, id: parameter.parameterId, testId: id, active: true,
            referenceRange: parameter.reference.displayValue,
          })),
          resolvedReferences: Object.fromEntries(test.parameters.map((parameter) => [parameter.parameterId, parameter.reference.displayValue ?? ""])),
          referenceResolutions: Object.fromEntries(test.parameters.map((parameter) => [parameter.parameterId, parameter.reference])),
          results: results[index],
          collectedOn: samples.data.find((row) => row.billId === bill.id && row.testId === id && ["COLLECTED", "RECOLLECTED"].includes(row.sampleStatus))?.lastStatusChangeAt,
        };
      });
    },
    enabled: ids.length > 0,
    staleTime: 0,
    retry: false,
  });

  return createPortal(<Dialog open onOpenChange={(open) => { if (!open) onClose(); }} title="Print reports" size="lg" className="lis-print-dialog">
    <div className="lis-print-controls">
      <p>{bill.billNumber} · {ids.length} selected report{ids.length === 1 ? "" : "s"}</p>
      <div className="lis-print-options">
        <label><input type="checkbox" checked={includeHeader} onChange={(event) => { setIncludeHeader(event.target.checked); if (event.target.checked) setLetterhead(false); }} />Include Header</label>
        <label><input type="checkbox" checked={letterhead} onChange={(event) => { setLetterhead(event.target.checked); if (event.target.checked) setIncludeHeader(false); }} />Print On LetterHead</label>
        <label><input type="checkbox" checked={onlyEntered} onChange={(event) => setOnlyEntered(event.target.checked)} />Print ONLY Entered Params</label>
      </div>
      {reports.isPending && <p role="status">Loading selected reports…</p>}
      {reports.isError && <p role="alert">{reports.error.message}</p>}
      {printError && <p role="alert">{printError}</p>}
      <div className="flex justify-end gap-2 pb-3">
        <Button disabled={!reports.data?.length || reports.isFetching || checking} onClick={async () => {
          setChecking(true); setPrintError(null); setPreview(false);
          try { const latest = await reports.refetch(); if (latest.error) throw latest.error; if (!latest.data?.length) throw new Error("Select submitted tests to print."); setPreview(true); }
          catch (error) { setPrintError(error instanceof Error ? error.message : "Unable to generate this report."); }
          finally { setChecking(false); }
        }}>Generate report</Button>
        <Button disabled={!preview || !reports.data?.length || reports.isFetching || checking || reports.isError} onClick={async () => {
          setChecking(true); setPrintError(null);
          try {
            if (typeof bill.patientId !== "object") throw new Error("Select a patient before printing.");
            requireReportEligibility(await checkResultReportEligibility(bill.id, ids), bill.id, bill.patientId.id, ids);
            await printDocument(documentRef.current);
          } catch (error) { setPreview(false); setPrintError(error instanceof Error ? error.message : "Unable to print this report."); }
          finally { setChecking(false); }
        }}>Print</Button>
        <Button variant="outline" onClick={onClose}>Close preview</Button>
      </div>
    </div>
    {preview && !reports.isError && reports.data && <div ref={documentRef} className="lis-print-document lis-result-print-document" data-print-mode={printMode} aria-label="Selected report preview">
      <div className="lis-clinical-page-watermark" aria-hidden="true"><Image src="/Main logo.png" alt="" width={1254} height={1254} unoptimized loading="eager" /></div>
      {reports.data.map((report, index) => <div key={report.item.testId} className="lis-result-print-part" data-new-page={reportStartsPage(printMode, index, report.item.departmentName, reports.data[index - 1]?.item.departmentName)}><PrintPreview
        bill={bill} testName={report.item.testName} departmentName={report.item.departmentName}
        collectedOn={report.collectedOn} parameters={report.parameters} results={report.results} resolvedReferences={report.resolvedReferences} referenceResolutions={report.referenceResolutions}
        technician={technician} signatureNote={technician?.signatureNote} documentTitle={`${bill.billNumber}-${report.item.testCode}`}
        visible includeHeader={includeHeader} letterhead={letterhead} onlyEntered={onlyEntered} /></div>)}
    </div>}
  </Dialog>, document.body);
}
