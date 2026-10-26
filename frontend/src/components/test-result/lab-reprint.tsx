"use client";
import {fetchLabBill} from "@/services/billing";
import {resultPresentation} from "@/lib/result-presentation";
import {ReportStationery} from "./report-stationery";
import {smearReportText,repeatedSmearLabel,compactSmearParameters,compactSmearValue} from "@/lib/smear-report-text";
import { cbcCountValueOnly, cbcSmearEmptyCells, reportCellText } from "../../../../backend/src/utils/cbc-report-display";
import { resultDisplay } from "../../../../backend/src/utils/result-display";
import { ReportLetterhead } from "./report-letterhead";
import { ReportPageFooter } from "./report-page-footer";

import { isReportNarrative, reportNarrative } from "@/lib/report-narrative";
import { type ReactNode, Fragment, useEffect, useRef, useMemo, useState } from "react";
import { businessDateInput, businessTimeInput } from "@/lib/business-date";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Printer,
  PrinterCheck,
  RotateCcw,
  Search,
} from "lucide-react";
import { checkBillDocumentEligibility } from "@/services/test-results";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { LisSendDialog } from "@/components/whatsapp/lis-send-dialog";
import { sendWhatsAppTestMessage } from "@/services/whatsapp";
import { BillPageHeader } from "@/components/billing/bill-page-header";
import { fetchLabBills } from "@/services/billing";
import {
  fetchLabSamples,
  fetchLabTechnicians,
} from "@/services/test-results";
import { formatDate, formatGender, cn } from "@/lib/utils";
import { formatPatientDisplayName } from "@/lib/patient-title";
import { patientAgeYears } from "@/lib/patient-age";
import { queryKeys } from "@/lib/query-keys";
import { useRouter } from "next/navigation";
import type { BillListParams } from "@/services/billing";
import {enteredReportParameters} from "@/lib/entered-report-parameters";
import { reportReferenceText } from "@/lib/report-reference";
import { enteredNumber, previewFlag } from "@/lib/result-preview";
import { usesClinicalReference } from "@/lib/parameter-reference-eligibility";
import { InvoicePrintDialog } from "@/components/test-result/invoice-print-dialog";
import type { LabBill } from "@/types/billing";
import type {
  LabSampleRow,
  LabTestParameter,
  LabTechnician,
  LabTestResult,
  ReferenceResolution,
} from "@/types/test-result";

type BillMode = "today" | "criteria";

const todayInput = businessDateInput;

function toPatientBill(bill: LabBill) {
  return typeof bill.patientId === "object" ? bill.patientId : null;
}

/**
 * Digits-only form of a stored mobile, used purely for validation. The value
 * sent to the API is always the patient's own stored mobile field.
 */
function toPhoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function LabReprint({initialBillId}:{initialBillId?:string}={}) {
  const router = useRouter();
  const [mode, setMode] = useState<BillMode>("today");
  const [fromDate, setFromDate] = useState(todayInput);
  const [toDate, setToDate] = useState(todayInput);
  const [billNumber, setBillNumber] = useState("");
  const [patientName, setPatientName] = useState("");
  const [billParams, setBillParams] = useState<BillListParams>({
    status: "generated",
    fromDate: todayInput(),
    toDate: todayInput(),
    limit: 50,
  });

  const [selectedBill, setSelectedBill] = useState<LabBill | null>(null);
  const initialApplied=useRef(false);
  const initialBill=useQuery({queryKey:["lab-bills","history-reprint",initialBillId],queryFn:()=>fetchLabBill(initialBillId!),enabled:Boolean(initialBillId)});
  useEffect(()=>{if(initialBill.data&&!initialApplied.current){initialApplied.current=true;setSelectedBill(initialBill.data);setBillNumber(initialBill.data.billNumber);setMode("criteria");setBillParams({status:"generated",search:initialBill.data.billNumber,limit:50});}},[initialBill.data]);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [signatureId, setSignatureId] = useState<string>("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [lisWhatsappOpen, setLisWhatsappOpen] = useState(false);
  const [whatsappSending, setWhatsappSending] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);

  const billsQuery = useQuery({
    queryKey: [...queryKeys.labBills, "reprint", billParams],
    queryFn: () => fetchLabBills(billParams),
  });

  const techniciansQuery = useQuery({
    queryKey: ["lab-technicians"],
    queryFn: fetchLabTechnicians,
  });

  const billSamplesQuery = useQuery({
    queryKey: [...queryKeys.labSamples, "bill", selectedBill?.billNumber],
    queryFn: () =>
      fetchLabSamples({ mode: "criteria", billNumber: selectedBill?.billNumber ?? "" }),
    enabled: Boolean(selectedBill),
  });


  const bills = billsQuery.data?.data ?? [];
  const selectedBillTests = selectedBill?.items ?? [];

  const sampleByTest = useMemo(() => {
    const map = new Map<string, LabSampleRow>();
    for (const row of billSamplesQuery.data?.data ?? []) {
      map.set(row.testId, row);
    }
    return map;
  }, [billSamplesQuery.data]);

  const selectedTest = selectedTestId
    ? selectedBillTests.find((item) => item.testId === selectedTestId) ?? null
    : null;

  const selectedPatient = selectedBill ? toPatientBill(selectedBill) : null;


  const runSearch = () => {
    const next: BillListParams = { status: "generated", limit: 50 };
    if (mode === "today") {
      next.fromDate = todayInput();
      next.toDate = todayInput();
    } else {
      if (fromDate) next.fromDate = fromDate;
      if (toDate) next.toDate = toDate;
      const bill = billNumber.trim();
      const name = patientName.trim();
      if (bill) next.search = bill;
      if (name && !bill) next.search = name;
    }
    setBillParams(next);
    setSelectedBill(null);
    setSelectedTestId(null);
    setNotice(null);
    setError(null);
  };

  const selectBill = (bill: LabBill) => {
    setSelectedBill(bill);
    setSelectedTestId(bill.items.length > 0 ? bill.items[0].testId : null);
    setNotice(null);
    setError(null);
  };

  const selectTest = (testId: string) => {
    setSelectedTestId(testId);
    setNotice(null);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!selectedBill) {
      setError("Select a bill before opening its invoice.");
      return;
    }
    setError(null);
    try { await checkBillDocumentEligibility(selectedBill.id); setInvoiceOpen(true); } catch(reason) { setError(reason instanceof Error?reason.message:"Unable to verify document eligibility"); }
  };

  /**
   * Opens the WhatsApp confirmation for the current selection. Nothing is sent
   * here — selecting a bill/test must never dispatch a message.
   */
  const handleWhatsAppOpen = () => {
    setNotice(null);
    setError(null);

    if (!selectedBill || !selectedTestId) {
      setError("Select a bill and a test before sending on WhatsApp.");
      return;
    }

    const mobile = selectedPatient?.mobile?.trim() ?? "";
    if (!mobile) {
      setError("This patient does not have a mobile number.");
      return;
    }

    const digits = toPhoneDigits(mobile);
    if (digits.length < 10 || digits.length > 15) {
      setError(
        `"${mobile}" is not a valid WhatsApp number for ${selectedPatient?.fullName ?? "this patient"}.`,
      );
      return;
    }

    setWhatsappOpen(true);
  };

  const handleWhatsAppSend = async () => {
    const mobile = selectedPatient?.mobile?.trim() ?? "";
    const digits = toPhoneDigits(mobile);

    // Defensive: never call the API without a valid number from the selected
    // patient. The recipient is always `patient.mobile` — it is never typed in
    // here and never a hardcoded test number.
    if (!selectedBill || !mobile || digits.length < 10 || digits.length > 15) {
      setWhatsappOpen(false);
      setError(
        !mobile
          ? "This patient does not have a mobile number."
          : `"${mobile}" is not a valid WhatsApp number.`,
      );
      return;
    }

    setWhatsappSending(true);
    setError(null);

    try {
      // Reuses the existing server-side sender (POST /api/whatsapp/test-message)
      // and the approved `report_ready` Utility template.
      //
      // That template has NO body variables, so no `components` array is sent —
      // only the recipient, the template name and the language.
      const result = await sendWhatsAppTestMessage({
        to: mobile,
        templateName: "report_ready",
        languageCode: "en",
      });

      setWhatsappOpen(false);
      setNotice(
        `WhatsApp message accepted by Meta for ${selectedPatient?.fullName ?? "the patient"} (${mobile}) using the report_ready template. Message id: ${result.metaMessageId}`,
      );
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "The WhatsApp message could not be sent.",
      );
    } finally {
      setWhatsappSending(false);
    }
  };

  const handleClear = () => {
    setSelectedBill(null);
    setSelectedTestId(null);
    setNotice(null);
    setError(null);
  };

  const handleHome = () => router.push("/dashboard");

  return (
    <div className="lis-reprint space-y-3">
      <div className="print:hidden">
        <BillPageHeader
          icon={PrinterCheck}
          title="Lab Reprint"
          subtitle="Preview and reprint the investigation bill"
          actions={
            <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
              <Printer className="size-3" />
              Bill Reprint
            </Badge>
          }
        />

        {notice && (
          <div
            role="status"
            className="mt-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800"
          >
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-3 space-y-3">
          <Card className="border-border shadow-sm">
            <CardContent className="space-y-3 p-3">
              <fieldset>
                <legend className="sr-only">Reprint bill filter</legend>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <label className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="reprintMode"
                      checked={mode === "today"}
                      onChange={() => setMode("today")}
                      className="size-3.5 accent-primary"
                    />
                    Today Lab Bills
                  </label>
                  <label className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="reprintMode"
                      checked={mode === "criteria"}
                      onChange={() => setMode("criteria")}
                      className="size-3.5 accent-primary"
                    />
                    Criteria
                  </label>
                </div>
              </fieldset>

              {mode === "criteria" && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="reprintFromDate">Bill Date From</Label>
                    <Input
                      id="reprintFromDate"
                      type="date"
                      value={fromDate}
                      onChange={(event) => setFromDate(event.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reprintToDate">Bill Date To</Label>
                    <Input
                      id="reprintToDate"
                      type="date"
                      value={toDate}
                      onChange={(event) => setToDate(event.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reprintBillNo">Bill No</Label>
                    <Input
                      id="reprintBillNo"
                      type="text"
                      value={billNumber}
                      onChange={(event) => setBillNumber(event.target.value)}
                      className="h-8 font-mono uppercase"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reprintPatientName">Patient Name</Label>
                    <Input
                      id="reprintPatientName"
                      type="text"
                      value={patientName}
                      onChange={(event) => setPatientName(event.target.value)}
                      className="h-8"
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <Button type="button" onClick={runSearch} disabled={billsQuery.isFetching}>
                  {billsQuery.isFetching ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Search />
                  )}
                  Search
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-5">
            <Card className="border-border shadow-sm xl:col-span-3">
              <CardContent className="p-0">
                <div className="border-b border-border px-3 py-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Lab Bills
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Select a bill to preview its report
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="lis-bill-summary w-full min-w-[610px] table-fixed text-xs">
                <colgroup>{[22,20,26,15,17].map((width,index)=><col key={index} style={{width:width+"%"}} />)}</colgroup>
                    <thead>
                      <tr className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-1.5">Bill No</th>
                        <th className="px-3 py-1.5">Pat Id</th>
                        <th className="px-3 py-1.5">Pat Name</th>
                        <th className="px-3 py-1.5">Sex/Age</th>
                        <th className="px-3 py-1.5">Bill Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billsQuery.isLoading ? (
                        <tr className="border-t border-border">
                          <td colSpan={5} className="px-3 py-6 text-center text-xs text-muted-foreground">
                            Loading bills…
                          </td>
                        </tr>
                      ) : bills.length === 0 ? (
                        <tr className="border-t border-border">
                          <td colSpan={5} className="px-3 py-6 text-center text-xs text-muted-foreground">
                            No Records To Display
                          </td>
                        </tr>
                      ) : (
                        bills.map((bill) => {
                          const patient = toPatientBill(bill);
                          const selected = selectedBill?.id === bill.id;
                          return (
                            <tr
                              key={bill.id}
                              aria-selected={selected}
                              onClick={() => selectBill(bill)}
                              className={cn(
                                "cursor-pointer border-t border-border transition-colors",
                                selected ? "bg-blue-50" : "hover:bg-slate-50",
                              )}
                            >
                              <td className="px-3 py-1.5 font-mono font-medium text-slate-800">
                                {bill.billNumber}
                              </td>
                              <td className="px-3 py-1.5 font-mono text-slate-700">
                                {patient?.patientId ?? "—"}
                              </td>
                              <td className="px-3 py-1.5 font-medium text-slate-800">
                                {patient ? formatPatientDisplayName({ title: patient.title, displayName: patient.displayName, fullName: patient.fullName }) : "—"}
                              </td>
                              <td className="px-3 py-1.5 text-slate-700">
                                {patient
                                  ? `${formatGender(patient.gender)}${patientAgeYears(patient) !== undefined ? ` / ${patientAgeYears(patient)}` : ""}`
                                  : "—"}
                              </td>
                              <td className="px-3 py-1.5 text-slate-700">
                                {bill.createdAt ? formatDate(bill.createdAt) : "—"}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm xl:col-span-2">
              <CardContent className="p-0">
                <div className="border-b border-border px-3 py-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Tests
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {selectedBill
                      ? `${selectedBill.billNumber} · ${selectedBillTests.length} test${selectedBillTests.length === 1 ? "" : "s"}`
                      : "Select a bill to view its tests"}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-1.5">Dept Name</th>
                        <th className="px-3 py-1.5">Test Name</th>
                        <th className="px-3 py-1.5">Sample</th>
                        <th className="px-3 py-1.5">Out</th>
                        <th className="px-3 py-1.5">Lab Center</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!selectedBill ? (
                        <tr className="border-t border-border">
                          <td colSpan={5} className="px-3 py-6 text-center text-xs text-muted-foreground">
                            Select a bill
                          </td>
                        </tr>
                      ) : (
                        selectedBillTests.map((item) => {
                          const sampleRow = sampleByTest.get(item.testId);
                          const closed = sampleRow?.testStatus === "CLOSED";
                          const selected = selectedTestId === item.testId;
                          return (
                            <tr
                              key={item.testId}
                              onClick={() => selectTest(item.testId)}
                              className={cn(
                                "cursor-pointer border-t border-border transition-colors",
                                selected ? "bg-blue-50" : "hover:bg-slate-50",
                              )}
                            >
                              <td className="px-3 py-1.5 text-slate-700">{item.departmentName}</td>
                              <td className="px-3 py-1.5">
                                <p className="text-xs font-medium text-slate-800">{item.testName}</p>
                                <p className="font-mono text-[11px] text-muted-foreground">{item.testCode === "INVG2044" ? "" : item.testCode}</p>
                              </td>
                              <td className="px-3 py-1.5 text-slate-700">
                                {sampleRow?.sampleType || "—"}
                              </td>
                              <td className="px-3 py-1.5">
                                <span
                                  className={cn(
                                    "font-medium",
                                    closed ? "text-emerald-600" : "text-slate-400",
                                  )}
                                >
                                  {closed ? "✓" : "—"}
                                </span>
                              </td>
                              <td className="px-3 py-1.5 text-slate-700">{item.departmentName}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {selectedBill && selectedTest && (
            <div className="flex flex-wrap items-center justify-end gap-3">
              <Label htmlFor="reprintSignature" className="text-sm">
                Select Signature to print :
              </Label>
              <Select
                id="reprintSignature"
                value={signatureId}
                onChange={(event) => setSignatureId(event.target.value)}
                className="h-8 w-72"
              >
                <option value="">Lab Technician</option>
                {(techniciansQuery.data ?? []).map((technician) => (
                  <option key={technician.id} value={technician.id}>
                    {technician.name} — {technician.designation}
                    {technician.qualification ? ` (${technician.qualification})` : ""}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2 pt-3">
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!selectedBill}
            >
              <PrinterCheck />
              Submit
            </Button>
            <Button type="button" variant="outline" onClick={handleClear}>
              <RotateCcw />
              Clear
            </Button>
            <Button type="button" variant="outline" onClick={handleHome}>
              Home
            </Button>
            <Button type="button" disabled={!selectedBill} onClick={handleSubmit}>
              <Printer />
              Print
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setLisWhatsappOpen(true)}
              disabled={!selectedBill || !selectedPatient?.mobile?.trim() || whatsappSending}
            >
              <MessageSquare />
              Send WhatsApp
            </Button>
          </div>
        </div>
      </div>

      {lisWhatsappOpen && selectedBill && <LisSendDialog key={selectedBill.id} input={{
        patientId: typeof selectedBill.patientId === "object" ? selectedBill.patientId.id : selectedBill.patientId,
        billId: selectedBill.id, workflow: "lab-reprint", testIds: selectedTestId ? [selectedTestId] : [],
        ...(signatureId ? { technicianId: signatureId } : {}), onlyEntered: false, printMode: "continuous",
      }} onClose={() => setLisWhatsappOpen(false)} onLegacyReportReady={() => {
        setLisWhatsappOpen(false); handleWhatsAppOpen();
      }} />}
      <Dialog
        open={whatsappOpen}
        onOpenChange={setWhatsappOpen}
        title="Send Report on WhatsApp?"
        centered
      >
        <div className="space-y-3">
          <dl className="space-y-1.5 text-sm">
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-muted-foreground">Patient:</dt>
              <dd className="font-medium text-slate-800">
                {selectedPatient ? formatPatientDisplayName({ title: selectedPatient.title, displayName: selectedPatient.displayName, fullName: selectedPatient.fullName }) : "—"}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-muted-foreground">Mobile:</dt>
              <dd className="font-mono font-medium text-slate-800">
                {selectedPatient?.mobile ?? "—"}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-muted-foreground">Bill No:</dt>
              <dd className="font-mono font-medium text-slate-800">
                {selectedBill?.billNumber ?? "—"}
              </dd>
            </div>
          </dl>

          <p className="text-xs text-muted-foreground">
            Sends the approved <span className="font-medium">report_ready</span>{" "}
            template to the mobile number on this patient&apos;s record. The
            template has no dynamic fields and no report link is attached yet.
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => setWhatsappOpen(false)}
              disabled={whatsappSending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleWhatsAppSend}
              disabled={whatsappSending}
            >
              {whatsappSending && <Loader2 className="size-4 animate-spin" />}
              Send WhatsApp
            </Button>
          </div>
        </div>
      </Dialog>

      {invoiceOpen && selectedBill && <InvoicePrintDialog bill={selectedBill} onClose={() => setInvoiceOpen(false)} />}
    </div>
  );
}

/**
 * Print template.
 *
 * Reproduces the reference report (LReport432769) — A4, black on white, thin
 * rules, no cards or dashboard styling. Every value comes from the selected
 * record; only the letterhead/footer wording below is fixed report stationery.
 */

/** `dd-mm-yyyy hh:mm AM/PM`, matching the reference report. */
function formatReportDateTime(value?: string | Date | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const [year,month,day] = businessDateInput(date).split("-");
  const [hours,minutes] = businessTimeInput(date).split(":").map(Number);
  return `${day}-${month}-${year} ${String(hours % 12 || 12).padStart(2,"0")}:${String(minutes).padStart(2,"0")} ${hours>=12?"PM":"AM"}`;
}

function ReportInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div data-patient-name={label === "Name" || undefined} data-info-label={label} className="grid grid-cols-[74pt_1fr] text-[8.5pt] leading-[13pt]">
      <span className="font-bold uppercase">{label}</span>
      <span className="lis-info-value"><span aria-hidden="true">:</span><span>{value || "—"}</span></span>
    </div>
  );
}

export function PrintPreview({
  shareQrDataUrl,
  bill,
  testName,
  departmentName,
  parameters,
  results,
  technician,
  signatureNote,
  signatureAsset,
  documentTitle,
  visible = false,
  includeHeader = true,
  letterhead = false,
  onlyEntered = false,
  resolvedReferences,
  referenceResolutions,
  reportTests,
}: {
  bill: LabBill | null;
  testName: string;
  /** Present for callers that pass it; the reference report prints no test code. */
  testCode?: string;
  departmentName: string;
  collectedOn?: string;
  parameters: LabTestParameter[];
  results: LabTestResult[];
  technician: LabTechnician | null;
  signatureNote?: string;
  signatureAsset?: "/technician-signature.svg" | null;
  documentTitle: string;
  visible?: boolean;
  includeHeader?: boolean;
  letterhead?: boolean;
  onlyEntered?: boolean;
  resolvedReferences?: Record<string, string>;
  referenceResolutions?: Record<string, ReferenceResolution>;
  /** Department consolidation reuses the exact individual parameter rows. */
  reportTests?: ReportTestContent[];
  reportNote1?:string;reportNote2?:string;shareQrDataUrl?:string;
}) {
  const patient = bill ? toPatientBill(bill) : null;
  const reportEnding = (includeQr = true) => (
    <tr><td colSpan={4} className="lis-clinical-ending-cell">
      <div className="lis-clinical-ending">
        <ReportPageFooter technicianName={technician?.name} signatureNote={signatureNote} signatureAsset={signatureAsset} reportQrDataUrl={includeQr ? shareQrDataUrl : undefined} />
      </div>
    </td></tr>
  );

  // "REPORTED ON" is the newest entry across the test's results.
  const reportedOn = (reportTests ? reportTests.flatMap(test=>test.results) : results).reduce<string | undefined>((latest, result) => {
    if (!result.enteredAt) return latest;
    if (!latest) return result.enteredAt;
    return new Date(result.enteredAt) > new Date(latest)
      ? result.enteredAt
      : latest;
  }, undefined);


  return (
    <section
      aria-label="Print preview"
      className={visible ? "block" : "hidden print:block"}
      data-print-title={documentTitle}
    >
      {bill && patient && (
        <div className="lis-report-paper lis-report-artwork mx-auto w-[186mm] bg-white font-serif text-[9pt] leading-[13pt] text-black">
          <ReportStationery includeHeader={includeHeader && !letterhead}/>
          {/* Results */}
          <table className="mt-[2mm] w-full table-fixed border-collapse text-left align-top">
            <colgroup>
              <col className="w-[35.7%]" />
              <col className="w-[26.6%]" />
              <col className="w-[12.9%]" />
              <col className="w-[24.8%]" />
            </colgroup>
            <thead>
              <tr><td colSpan={4} className="lis-clinical-repeat-header">
          {/* Letterhead */}
          <ReportLetterhead includeHeader={includeHeader} letterhead={letterhead} />
          <div className="mt-[2mm] h-px" aria-hidden="true"/>


          {/* Patient / bill information */}
          <div className="lis-clinical-info mt-[1.5mm] grid grid-cols-2 gap-x-[6mm]">
            <div>
              <ReportInfoRow label="Patient Id" value={patient.patientId} />
              <ReportInfoRow label="Name" value={formatPatientDisplayName({ title: patient.title, displayName: patient.displayName, fullName: patient.fullName })} />
              <ReportInfoRow
                label="Gender / Age"
                value={`${formatGender(patient.gender)}${
                  patientAgeYears(patient) !== undefined
                    ? ` / ${patientAgeYears(patient)} years`
                    : ""
                }`}
              />
              <ReportInfoRow label="Mobile No" value={patient.mobile} />
              <ReportInfoRow label="Ref Dr." value={bill.doctorName ?? "Self"} />
            </div>
            <div>
              <ReportInfoRow label="Bill No" value={bill.billNumber} />
              <ReportInfoRow
                label="Bill Date"
                value={formatReportDateTime(bill.createdAt)}
              />

              <ReportInfoRow
                label="Reported On"
                value={formatReportDateTime(reportedOn)}
              />
              <ReportInfoRow
                label="Printed On"
                value={formatReportDateTime(new Date())}
              />
            </div>
          </div>

          <div className="mt-[1.5mm] border-t border-black" />

          {/* Department + investigation title */}
          <p className="mt-[2mm] text-center text-[10pt] font-bold uppercase">
            Department of {departmentName || "—"}
          </p>
          {!reportTests && <p className="mt-[1.5mm] text-center text-[11pt] font-bold uppercase">{testName || "—"}</p>}

              </td></tr>
              <tr className="border-t border-black text-[8.5pt] font-bold">
                <th className="py-[1mm] pr-[2mm] text-left font-bold">
                  Investigation
                </th>
                <th className="py-[1mm] pr-[2mm] text-left font-bold">Result</th>
                <th className="py-[1mm] pr-[2mm] text-left font-bold">Units</th>
                <th className="py-[1mm] text-left font-bold">
                  Reference Range
                </th>
              </tr>
              <tr className="border-t border-black">
                <th colSpan={4} className="p-0" />
              </tr>
            </thead>
            {reportTests ? reportTests.map((test,index)=><Fragment key={index}>
              <tbody data-report-test={test.testName}><tr><th colSpan={4} className="pt-[2mm] pb-[1mm] text-center font-bold uppercase">{test.testName}</th></tr>

              </tbody>
              <ReportParameterRows {...test} onlyEntered={onlyEntered} ending={reportEnding(index===reportTests.length-1)}/>
            </Fragment>) : <><ReportParameterRows parameters={parameters} results={results} onlyEntered={onlyEntered} resolvedReferences={resolvedReferences} referenceResolutions={referenceResolutions} ending={reportEnding()}/></>}


          </table>
        </div>
      )}
    </section>
  );
}

type ReportTestContent = {
  reportNote1?:string;reportNote2?:string;
  testName: string; collectedOn?: string; parameters: LabTestParameter[]; results: LabTestResult[];
  resolvedReferences?: Record<string,string>; referenceResolutions?: Record<string,ReferenceResolution>;
};
function ReportParameterRows({parameters,results,onlyEntered=false,resolvedReferences,referenceResolutions,ending}:Omit<ReportTestContent,"testName">&{onlyEntered?:boolean;ending?:ReactNode}) {
  const resultByParameter = new Map(
    results.map((result) => [result.parameterId, result] as const),
  );

  // Parameters grouped by their optional subtitle, in display order, so the
  // reference's DIFFERENTIAL COUNT / PERIPHERAL SMEAR headings are produced from
  // the real data instead of being hardcoded.
  const groups: { subtitle: string; rows: LabTestParameter[] }[] = [];
  const ordered=[...parameters].sort((a,b)=>a.displayOrder-b.displayOrder);
  for (const parameter of compactSmearParameters(onlyEntered?enteredReportParameters(ordered,results):ordered)) {
    const subtitle = (parameter.subtitle ?? "").trim();
    const last = groups[groups.length - 1];
    if (!last || last.subtitle !== subtitle) {
      groups.push({ subtitle, rows: [parameter] });
    } else {
      last.rows.push(parameter);
    }
  }

  const rows = groups.length === 0 ? (
                <tr className="border-b border-black">
                  <td colSpan={4} className="py-[1mm]">
                    No results entered for this test.
                  </td>
                </tr>
              ) : (
                groups.map((group) => (
                  [group.subtitle && (
                      <tr key={`group-${group.subtitle}`} className="break-inside-avoid">
                        <td
                          colSpan={4}
                          className="pb-[0.5mm] pt-[2mm] font-bold uppercase"
                        >
                          {group.subtitle}
                        </td>
                      </tr>
                    ),
                    ...group.rows.map((parameter) => {
                      if(parameter.itemType === "SUBTITLE")return <tr key={parameter.id}><th colSpan={4} className="py-[1mm] text-left font-bold">{parameter.parameterName}</th></tr>;
                      if (isReportNarrative(parameter)) {
                        const smear = /peripheral\s*smear/i.test(parameter.subtitle??group.subtitle) || cbcSmearEmptyCells(parameter);
                        const rawNarrative = reportNarrative(parameter, resultByParameter.get(parameter.id));
                        const narrative = smear ? smearReportText(rawNarrative) : rawNarrative;
                        return <tr key={parameter.id}><td colSpan={4} className="py-[1mm] text-left">
                          {(!smear || !repeatedSmearLabel(parameter.parameterName,narrative)) && <strong className="block">{parameter.parameterName}</strong>}
                          {narrative !== "" && <div className={cn("mt-[1mm] whitespace-pre-wrap break-words",resultPresentation(false,resultByParameter.get(parameter.id)?.editMetadata?.manuallyChanged,"report"))}>{narrative}</div>}
                        </td></tr>;
                      }
                      const valueOnly = cbcCountValueOnly(parameter);
                      const blankMissing=cbcSmearEmptyCells(parameter);
                      const result = resultByParameter.get(parameter.id);
                      const value = result?.result;
                      const smear = blankMissing || /peripheral\s*smear/i.test(parameter.subtitle??group.subtitle);
                      const display = smear ? compactSmearValue(parameter.parameterName,resultDisplay(value,result?.resultDisplay)) : resultDisplay(value,result?.resultDisplay);
                      const method = result?.method ?? parameter.method;
                      const reference = referenceResolutions?.[parameter.id];
                      const numericValue = !usesClinicalReference(parameter) ? undefined : typeof value === "number" ? value : enteredNumber(typeof value === "string" ? value : undefined);
                      const abnormal = reference
                        ? previewFlag(numericValue, reference) === "out-of-range"
                        : result?.referenceSnapshot?.flag === "OUT_OF_RANGE";
                      return (
                        <tr
                          key={parameter.id}
                          data-smear-row={smear || undefined}
                          className="break-inside-avoid align-top"
                        >
                          <td className="py-[0.7mm] pr-[2mm]">
                            <span className="font-bold">
                              {smear && repeatedSmearLabel(parameter.parameterName,display) ? "" : parameter.parameterName}
                            </span>
                            {method ? (
                              <span className="block text-[7.5pt] italic leading-[10pt]">
                                (Method: {method})
                              </span>
                            ) : null}
                          </td>
                          <td
                            className={cn(
                              "py-[0.7mm] pr-[2mm] whitespace-pre-wrap",
                              resultPresentation(abnormal,result?.editMetadata?.manuallyChanged,"report"),
                              valueOnly && "lis-cbc-count-result",
                            )}
                          >
                            {display}
                          </td>
                          <td className="py-[0.7mm] pr-[2mm]">
                            {reportCellText(result?.unit ?? parameter.unit, true).trim().replace(/^[-–—]$/, "")}
                          </td>
                          <td className="py-[0.7mm]">
                            {blankMissing
                              ? reportCellText(
                                  usesClinicalReference(parameter)
                                    ? reportReferenceText(parameter.id, resolvedReferences, result?.referenceRange ?? parameter.referenceRange)
                                    : result?.referenceRange ?? parameter.referenceRange,
                                  true,
                                )
                              : usesClinicalReference(parameter)
                                ? reportReferenceText(parameter.id, resolvedReferences, result?.referenceRange ?? parameter.referenceRange) || "—"
                                : "—"}
                          </td>
                        </tr>
                      );
                    })]
                )).flat());
  const renderedRows = (Array.isArray(rows) ? rows : [rows]).filter(Boolean);
  // Keep the last clinical rows with the signatures and QR on the final page.
  const tailStart = Math.max(0, renderedRows.length - 3);
  return <><tbody>{renderedRows.slice(0, tailStart)}</tbody>
    <tbody className="lis-report-final-rows">{renderedRows.slice(tailStart)}{ending}</tbody></>;
}

export default LabReprint;
