"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Home,
  Loader2,
  Mail,
  MessageSquare,
  Printer,
  PrinterCheck,
  RotateCcw,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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

  const handleDemo = (channel: "mail" | "whatsapp") => {
    setNotice(
      channel === "mail"
        ? "Send E-Mail is a demo placeholder — real dispatch will be available in a later phase."
        : "Send WhatsApp is a demo placeholder — real dispatch will be available in a later phase.",
    );
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
            <Button type="button" variant="outline" onClick={() => handleDemo("mail")}>
              <Mail />
              Send Mail
            </Button>
            <Button type="button" variant="outline" onClick={() => handleDemo("whatsapp")}>
              <MessageSquare />
              Send Whatsapp
            </Button>
          </div>
        </div>
      </div>

      <PrintPreview
        bill={selectedBill}
        testName={selectedTest?.testName ?? ""}
        testCode={selectedTest?.testCode ?? ""}
        parameters={parametersQuery.data ?? []}
        results={resultsQuery.data ?? []}
        technician={selectedTechnician}
        signatureNote={signatureId ? selectedTechnician?.signatureNote : undefined}
        documentTitle={printableName()}
      />
    </div>
  );
}

export function PrintPreview({
  bill,
  testName,
  testCode,
  parameters,
  results,
  technician,
  signatureNote,
  documentTitle,
}: {
  bill: LabBill | null;
  testName: string;
  testCode: string;
  parameters: LabTestParameter[];
  results: LabTestResult[];
  technician: LabTechnician | null;
  signatureNote?: string;
  documentTitle: string;
}) {
  const patient = bill ? toPatientBill(bill) : null;
  return (
    <section
      aria-label="Print preview"
      className="hidden print:block"
      data-print-title={documentTitle}
    >
      {bill && patient && (
        <div className="mx-auto max-w-2xl rounded-none border-0 p-4 text-sm text-slate-900">
          <div className="border-b-2 border-slate-900 pb-2 text-center">
            <h1 className="text-lg font-bold">Diagnostic Centre</h1>
            <p className="text-xs">Clinical Laboratory Investigation Report</p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
            <p>
              <span className="font-semibold">Report No :</span> {bill.billNumber}
            </p>
            <p>
              <span className="font-semibold">Report Date :</span>{" "}
              {bill.createdAt ? formatDate(bill.createdAt) : "—"}
            </p>
            <p>
              <span className="font-semibold">Patient Id :</span> {patient.patientId}
            </p>
            <p>
              <span className="font-semibold">Patient Name :</span> {patient.fullName}
            </p>
            <p>
              <span className="font-semibold">Sex :</span> {formatGender(patient.gender)}
            </p>
            <p>
              <span className="font-semibold">Age :</span> {patient.age ?? "—"}
            </p>
            <p>
              <span className="font-semibold">Test :</span> {testName} ({testCode})
            </p>
            <p>
              <span className="font-semibold">Referred By :</span>{" "}
              {bill.doctorName ?? "Self"}
            </p>
          </div>
          <table className="mt-4 w-full border-collapse text-left text-xs">
            <thead>
              <tr>
                <th className="border border-slate-900 px-2 py-1">#</th>
                <th className="border border-slate-900 px-2 py-1">Parameter</th>
                <th className="border border-slate-900 px-2 py-1">Result</th>
                <th className="border border-slate-900 px-2 py-1">Units</th>
                <th className="border border-slate-900 px-2 py-1">Reference Range</th>
              </tr>
            </thead>
            <tbody>
              {parameters.length === 0 ? (
                <tr>
                  <td colSpan={5} className="border border-slate-900 px-2 py-1">
                    No results entered for this test.
                  </td>
                </tr>
              ) : (
                parameters.map((parameter) => {
                  const value = results.find((r) => r.parameterId === parameter.id)?.result;
                  return (
                    <tr key={parameter.id}>
                      <td className="border border-slate-900 px-2 py-1">{parameter.displayOrder}</td>
                      <td className="border border-slate-900 px-2 py-1">{parameter.parameterName}</td>
                      <td className="border border-slate-900 px-2 py-1 font-medium">
                        {value === undefined || value === null || value === ""
                          ? "—"
                          : String(value)}
                      </td>
                      <td className="border border-slate-900 px-2 py-1">{parameter.unit ?? "—"}</td>
                      <td className="border border-slate-900 px-2 py-1">
                        {parameter.referenceRange ?? "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <div className="mt-6 flex items-end justify-between text-xs">
            <p className="text-muted-foreground">End of Report</p>
            <div className="text-center">
              <p className="border-t border-slate-900 px-6 pt-1">
                {technician ? technician.name : "Lab Technician"}
                {signatureNote ? ` (${signatureNote})` : ""}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {technician?.designation ?? "Signature"}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default LabReprint;