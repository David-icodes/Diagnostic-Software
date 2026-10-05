"use client";

import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Home,
  Loader2,
  MessageSquare,
  Printer,
  PrinterCheck,
  RotateCcw,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { sendWhatsAppTestMessage } from "@/services/whatsapp";
import { BillPageHeader } from "@/components/billing/bill-page-header";
import { fetchLabBills } from "@/services/billing";
import {
  fetchLabSamples,
  fetchLabTechnicians,
  fetchLabTestParameters,
  fetchTestResults,
} from "@/services/test-results";
import { formatDate, formatGender, cn } from "@/lib/utils";
import { queryKeys } from "@/lib/query-keys";
import { useRouter } from "next/navigation";
import type { BillListParams } from "@/services/billing";
import type { LabBill } from "@/types/billing";
import type {
  LabSampleRow,
  LabTestParameter,
  LabTechnician,
  LabTestResult,
} from "@/types/test-result";

type BillMode = "today" | "criteria";

function todayInput(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

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

export function LabReprint() {
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
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [signatureId, setSignatureId] = useState<string>("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [whatsappOpen, setWhatsappOpen] = useState(false);
  const [whatsappSending, setWhatsappSending] = useState(false);

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

  const parametersQuery = useQuery({
    queryKey: [...queryKeys.labTestParameters, "reprint", selectedTestId],
    queryFn: () =>
      selectedTestId ? fetchLabTestParameters(selectedTestId) : Promise.resolve([]),
    enabled: Boolean(selectedBill && selectedTestId),
  });

  const resultsQuery = useQuery({
    queryKey: [...queryKeys.testResults, selectedBill?.id, selectedTestId],
    queryFn: () =>
      selectedBill && selectedTestId
        ? fetchTestResults(selectedBill.id, selectedTestId)
        : Promise.resolve([]),
    enabled: Boolean(selectedBill && selectedTestId),
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

  const selectedTechnician =
    techniciansQuery.data?.find((technician) => technician.id === signatureId) ?? null;

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

  const handleSubmit = () => {
    if (!selectedBill || !selectedTestId) {
      setError("Select a bill and a test before submitting for print.");
      return;
    }
    setError(null);
    setNotice("Marked for print — open the preview below and use Print.");
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
    // Meta template parameters must not contain line breaks or tabs.
    const patientName = (selectedPatient?.fullName ?? "")
      .replace(/[\r\n\t]+/g, " ")
      .trim();

    // Defensive: never call the API without a valid number/name from the
    // selected patient. The recipient is always `patient.mobile` — it is never
    // typed in here and never a hardcoded test number.
    if (!selectedBill || !mobile || digits.length < 10 || digits.length > 15) {
      setWhatsappOpen(false);
      setError(
        !mobile
          ? "This patient does not have a mobile number."
          : `"${mobile}" is not a valid WhatsApp number.`,
      );
      return;
    }
    if (!patientName) {
      setWhatsappOpen(false);
      setError("This patient does not have a name on record.");
      return;
    }

    setWhatsappSending(true);
    setError(null);

    try {
      // Reuses the existing server-side sender (POST /api/whatsapp/test-message)
      // and the approved `report_ready` Utility template. The recipient is the
      // selected patient's stored mobile; body variable {{1}} is their full name.
      const result = await sendWhatsAppTestMessage({
        to: mobile,
        templateName: "report_ready",
        languageCode: "en",
        components: [
          {
            type: "body",
            parameters: [{ type: "text", text: patientName }],
          },
        ],
      });

      setWhatsappOpen(false);
      setNotice(
        `WhatsApp message accepted by Meta for ${patientName} (${mobile}) using the report_ready template. Message id: ${result.metaMessageId}`,
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

  const printableName = (): string => {
    if (!selectedBill) return "Accession";
    return selectedBill.billNumber;
  };

  return (
    <div className="space-y-3">
      <div className="print:hidden">
        <BillPageHeader
          icon={PrinterCheck}
          title="Lab Reprint"
          subtitle="Reprint a generated investigation report for a selected bill and test"
          actions={
            <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
              <Printer className="size-3" />
              Test Result
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
                      placeholder="OSP202600010"
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
                      placeholder="Search by name"
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
                  <table className="min-w-full text-xs">
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
                                {patient?.fullName ?? "—"}
                              </td>
                              <td className="px-3 py-1.5 text-slate-700">
                                {patient
                                  ? `${formatGender(patient.gender)}${patient.age !== undefined && patient.age !== null ? ` / ${patient.age}` : ""}`
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
                                <p className="font-mono text-[11px] text-muted-foreground">{item.testCode}</p>
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
              disabled={!selectedBill || !selectedTestId}
            >
              <PrinterCheck />
              Submit
            </Button>
            <Button type="button" variant="outline" onClick={handleClear}>
              <RotateCcw />
              Clear
            </Button>
            <Button type="button" variant="outline" onClick={handleHome}>
              <Home />
              Home
            </Button>
            <Button type="button" onClick={() => window.print()}>
              <Printer />
              Print
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleWhatsAppOpen}
              disabled={!selectedBill || !selectedTestId || whatsappSending}
            >
              <MessageSquare />
              Send WhatsApp
            </Button>
          </div>
        </div>
      </div>

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
                {selectedPatient?.fullName ?? "—"}
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
            template to the mobile number on this patient&apos;s record, greeting
            them by name. No report link is attached yet.
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

      <PrintPreview
        bill={selectedBill}
        testName={selectedTest?.testName ?? ""}
        testCode={selectedTest?.testCode ?? ""}
        departmentName={selectedTest?.departmentName ?? ""}
        collectedOn={
          selectedTestId
            ? sampleByTest.get(selectedTestId)?.lastStatusChangeAt
            : undefined
        }
        parameters={parametersQuery.data ?? []}
        results={resultsQuery.data ?? []}
        technician={selectedTechnician}
        signatureNote={signatureId ? selectedTechnician?.signatureNote : undefined}
        documentTitle={printableName()}
      />
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
const REPORT_WORDMARK = "ANJALI";
const REPORT_WORDMARK_SUB = "DIAGNOSTICS";
const REPORT_REGD_NO = "Regd. No. 414/DM & HO/RR/2008";
const REPORT_ADDRESS =
  "Plot No. 347, HMT Hills, Opp. Community Hall, Beside Park, Opp. JNTU, Kukatpally, Hyderabad - 500 085.";
const REPORT_CONTACT = "Contact : 9989 2209 38, 9440 6268 92, 040-40147350";

/** `dd-mm-yyyy hh:mm AM/PM`, matching the reference report. */
function formatReportDateTime(value?: string | Date | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const pad = (part: number) => String(part).padStart(2, "0");
  const hours = date.getHours();
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(hour12)}:${pad(date.getMinutes())} ${period}`;
}

function ReportInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[74pt_1fr] text-[8.5pt] leading-[13pt]">
      <span className="font-bold uppercase">{label}</span>
      <span>: {value}</span>
    </div>
  );
}

export function PrintPreview({
  bill,
  testName,
  departmentName,
  collectedOn,
  parameters,
  results,
  technician,
  signatureNote,
  documentTitle,
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
  documentTitle: string;
}) {
  const patient = bill ? toPatientBill(bill) : null;

  // "REPORTED ON" is the newest entry across the test's results.
  const reportedOn = results.reduce<string | undefined>((latest, result) => {
    if (!result.enteredAt) return latest;
    if (!latest) return result.enteredAt;
    return new Date(result.enteredAt) > new Date(latest)
      ? result.enteredAt
      : latest;
  }, undefined);

  const resultByParameter = new Map(
    results.map((result) => [result.parameterId, result] as const),
  );

  // Parameters grouped by their optional subtitle, in display order, so the
  // reference's DIFFERENTIAL COUNT / PERIPHERAL SMEAR headings are produced from
  // the real data instead of being hardcoded.
  const groups: { subtitle: string; rows: LabTestParameter[] }[] = [];
  for (const parameter of [...parameters].sort(
    (a, b) => a.displayOrder - b.displayOrder,
  )) {
    const subtitle = (parameter.subtitle ?? "").trim();
    const last = groups[groups.length - 1];
    if (!last || last.subtitle !== subtitle) {
      groups.push({ subtitle, rows: [parameter] });
    } else {
      last.rows.push(parameter);
    }
  }

  return (
    <section
      aria-label="Print preview"
      className="hidden print:block"
      data-print-title={documentTitle}
    >
      {bill && patient && (
        <div className="mx-auto w-[186mm] bg-white font-serif text-[9pt] leading-[13pt] text-black">
          {/* Letterhead */}
          <div className="leading-none">
            <p className="text-[26pt] font-bold uppercase leading-[26pt] tracking-[0.14em] text-[#005430]">
              {REPORT_WORDMARK}
            </p>
            <p className="mt-[1mm] text-[11pt] font-bold uppercase tracking-[0.22em] text-[#d8180c]">
              {REPORT_WORDMARK_SUB}
            </p>
            <p className="mt-[1.5mm] text-[7.5pt] font-bold">{REPORT_REGD_NO}</p>
          </div>

          <div className="mt-[2mm] border-t border-black" />

          {/* Patient / bill information */}
          <div className="mt-[1.5mm] grid grid-cols-2 gap-x-[6mm]">
            <div>
              <ReportInfoRow label="Patient Id" value={patient.patientId} />
              <ReportInfoRow label="Name" value={patient.fullName} />
              <ReportInfoRow
                label="Gender / Age"
                value={`${formatGender(patient.gender)}${
                  patient.age !== undefined && patient.age !== null
                    ? ` / ${patient.age} years`
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
                label="Collected On"
                value={formatReportDateTime(collectedOn)}
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
          <p className="mt-[1.5mm] text-center text-[11pt] font-bold uppercase">
            {testName || "—"}
          </p>

          {/* Results */}
          <table className="mt-[2mm] w-full table-fixed border-collapse text-left align-top">
            <colgroup>
              <col className="w-[35.7%]" />
              <col className="w-[26.6%]" />
              <col className="w-[12.9%]" />
              <col className="w-[24.8%]" />
            </colgroup>
            <thead>
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
            <tbody>
              {groups.length === 0 ? (
                <tr className="border-b border-black">
                  <td colSpan={4} className="py-[1mm]">
                    No results entered for this test.
                  </td>
                </tr>
              ) : (
                groups.map((group) => (
                  <Fragment key={`group-${group.subtitle || "main"}`}>
                    {group.subtitle && (
                      <tr className="break-inside-avoid">
                        <td
                          colSpan={4}
                          className="pb-[0.5mm] pt-[2mm] font-bold uppercase"
                        >
                          {group.subtitle}
                        </td>
                      </tr>
                    )}
                    {group.rows.map((parameter) => {
                      const result = resultByParameter.get(parameter.id);
                      const value = result?.result;
                      const method = result?.method ?? parameter.method;
                      const abnormal =
                        result?.referenceSnapshot?.flag === "OUT_OF_RANGE";
                      return (
                        <tr
                          key={parameter.id}
                          className="break-inside-avoid align-top"
                        >
                          <td className="py-[0.7mm] pr-[2mm]">
                            <span className="font-bold">
                              {parameter.parameterName}
                            </span>
                            {method ? (
                              <span className="block text-[7.5pt] italic leading-[10pt]">
                                (Method: {method})
                              </span>
                            ) : null}
                          </td>
                          <td
                            className={cn(
                              "py-[0.7mm] pr-[2mm]",
                              abnormal && "font-bold",
                            )}
                          >
                            {value === undefined ||
                            value === null ||
                            value === ""
                              ? "—"
                              : String(value)}
                          </td>
                          <td className="py-[0.7mm] pr-[2mm]">
                            {result?.unit ?? parameter.unit ?? "—"}
                          </td>
                          <td className="py-[0.7mm]">
                            {result?.referenceRange ??
                              parameter.referenceRange ??
                              "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>

          {/* Clinical note */}
          <p className="mt-[3mm] text-[8pt]">
            Note : Please Correlate Clinically if necessary kindly discuss.
          </p>

          <p className="mt-[2mm] text-center text-[9pt] font-bold">
            ****** END OF REPORT ******
          </p>

          {/* Technician / QR / signature */}
          <div className="mt-[5mm] grid grid-cols-[1fr_50pt_1fr] items-end gap-[4mm]">
            <p className="text-[8.5pt] font-bold">Lab Technician</p>
            {/* QR slot: the real code arrives with the secure report URL. */}
            <div className="flex h-[50pt] w-[50pt] items-center justify-center border border-black text-[6pt] uppercase">
              QR
            </div>
            <div className="text-center">
              {technician?.name ? (
                <p className="text-[9pt] font-bold">{technician.name}</p>
              ) : (
                <span className="block h-[10pt]" />
              )}
              <p className="text-[8.5pt] font-bold">Lab Technician</p>
              {signatureNote ? (
                <p className="text-[7pt] italic">{signatureNote}</p>
              ) : null}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-[5mm] border-t border-black pt-[1.5mm]">
            <div className="flex items-start justify-between gap-[4mm] text-[7.5pt] leading-[11pt]">
              <div>
                <p>{REPORT_ADDRESS}</p>
                <p>{REPORT_CONTACT}</p>
              </div>
              <p className="whitespace-nowrap">Page 1 of 1</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default LabReprint;