"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ResultPrintMode } from "@/lib/result-workflow";
import { orderedPrintIds } from "@/lib/lab-workflows";
import { generateBrowserReport } from "@/lib/browser-report";
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
  const [printError, setPrintError] = useState<string | null>(null);
  const ids = orderedPrintIds(bill.items, Object.fromEntries(testIds.map(id => [id, true])));

  const generate = async () => {
    if (checking) return;
    setPrintError(null);
    if (!ids.length || !bill.patientId) { setPrintError("Select a patient and submitted tests to print."); return; }
    setChecking(true);
    try {
      await generateBrowserReport({ billId: bill.id, testIds: ids, technicianId: technician?.id,
        onlyEntered, includeHeader, letterhead, printMode });
    } catch (error) {
      setPrintError(error instanceof Error ? error.message : "Unable to generate this report.");
    } finally { setChecking(false); }
  };

  return createPortal(<Dialog open onOpenChange={open => { if (!open && !checking) onClose(); }} title="Print reports" size="lg" className="lis-print-dialog">
    <div className="lis-print-controls">
      <p>{bill.billNumber} · {ids.length} selected report{ids.length === 1 ? "" : "s"}</p>
      <fieldset disabled={checking} className="lis-print-options">
        <legend className="sr-only">Report configuration</legend>
        <label><input type="radio" name="report-header" checked={includeHeader} onChange={() => { setIncludeHeader(true); setLetterhead(false); }} />Including Header</label>
        <label><input type="radio" name="report-header" checked={!includeHeader && !letterhead} onChange={() => { setIncludeHeader(false); setLetterhead(false); }} />Without Header</label>
        <label><input type="radio" name="report-header" checked={letterhead} onChange={() => { setLetterhead(true); setIncludeHeader(false); }} />Print On LetterHead</label>
        <label><input type="checkbox" checked={onlyEntered} onChange={event => setOnlyEntered(event.target.checked)} />Print ONLY Entered Params</label>
      </fieldset>
      {printError && <p role="alert">{printError}</p>}
      {checking && <p role="status">Generating report…</p>}
      <div className="flex justify-end gap-2 pb-3">
        <Button disabled={!ids.length || checking} onClick={generate}>{checking ? "Generating…" : "Generate Report"}</Button>
        <Button variant="outline" disabled={checking} onClick={onClose}>Close</Button>
      </div>
    </div>
  </Dialog>, document.body);
}
