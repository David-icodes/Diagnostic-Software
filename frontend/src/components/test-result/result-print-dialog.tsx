"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { ResultPrintMode } from "@/lib/result-workflow";
import { orderedPrintIds } from "@/lib/lab-workflows";
import { generateBrowserReport } from "@/lib/browser-report";
import type { LabBill } from "@/types/billing";
import type { LabTechnician } from "@/types/test-result";

export function ResultPrintDialog({ bill, testIds, technicians = [], onClose, initialOnlyEntered = false, printMode = "continuous" }: {
  bill: LabBill; testIds: string[]; technicians?: LabTechnician[]; onClose: () => void;
  initialOnlyEntered?: boolean; printMode?: ResultPrintMode;
}) {
  const [includeHeader, setIncludeHeader] = useState(true);
  const [onlyEntered, setOnlyEntered] = useState(initialOnlyEntered);
  const [technicianId, setTechnicianId] = useState("");
  const [layout, setLayout] = useState<ResultPrintMode>(printMode);
  const generating = useRef(false);
  const [checking, setChecking] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const ids = orderedPrintIds(bill.items, Object.fromEntries(testIds.map(id => [id, true])));
  const technician = technicians.find((row) => row.id === technicianId) ?? null;

  const generate = async (download = false) => {
    if (generating.current) return;
    setPrintError(null);
    if (!ids.length || !bill.patientId) { setPrintError("Select a patient and submitted tests to print."); return; }
    generating.current=true;
    setChecking(true);
    try {
      await generateBrowserReport({ billId: bill.id, testIds: ids, technicianId: technician?.id,
        onlyEntered, includeHeader, download, letterhead: !includeHeader, printMode: layout });
    } catch (error) {
      setPrintError(error instanceof Error ? error.message : "Unable to generate this report.");
    } finally { generating.current=false; setChecking(false); }
  };

  return createPortal(<Dialog open onOpenChange={open => { if (!open && !checking) onClose(); }} title="Print reports" size="lg" className="lis-print-dialog">
    <div className="lis-print-controls">
      <p>{bill.billNumber} · {ids.length} selected report{ids.length === 1 ? "" : "s"}</p>
      <div className="lis-print-options">
        {technicians.length > 0 && (
          <label>
            Signature
            <Select value={technicianId} onChange={(event) => setTechnicianId(event.target.value)} className="h-8 w-64">
              <option value="">No signature</option>
              {technicians.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name} — {row.designation}{row.qualification ? ` (${row.qualification})` : ""}
                </option>
              ))}
            </Select>
          </label>
        )}
        <label>
          Layout
          <Select value={layout} onChange={(event) => setLayout(event.target.value as ResultPrintMode)} className="h-8 w-44">
            <option value="continuous">Continuous Print</option>
            <option value="department">Department-wise</option>
            <option value="test">Test wise Print</option>
          </Select>
        </label>
      </div>
      <fieldset disabled={checking} className="lis-print-options">
        <legend className="sr-only">Report configuration</legend>
        <label><input type="radio" name="report-header" checked={includeHeader} onChange={() => setIncludeHeader(true)} />Including Header</label>
        <label><input type="radio" name="report-header" checked={!includeHeader} onChange={() => setIncludeHeader(false)} />Without Header</label>
        <label><input type="checkbox" checked={onlyEntered} onChange={event => setOnlyEntered(event.target.checked)} />Print ONLY Entered Params</label>
      </fieldset>
      {printError && <p role="alert">{printError}</p>}
      {checking && <p role="status">Generating report…</p>}
      <div className="flex justify-end gap-2 pb-3">
        <Button disabled={!ids.length || checking} onClick={() => void generate()}>{checking ? "Generating…" : "Generate Report"}</Button>
        <Button variant="secondary" disabled={!ids.length || checking} onClick={() => void generate(true)}>Download PDF</Button>
        <Button variant="outline" disabled={checking} onClick={onClose}>Close</Button>
      </div>
    </div>
  </Dialog>, document.body);
}
