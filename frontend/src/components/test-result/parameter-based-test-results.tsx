"use client";

import { useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  AlertCircle,
  Calculator,
  CheckCircle2,
  ClipboardList,
  Loader2,
  PenLine,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BillPageHeader } from "@/components/billing/bill-page-header";
import { BillActionBar } from "@/components/billing/bill-action-bar";
import { fetchLabBills } from "@/services/billing";
import {
  fetchBillResultEntry,
  fetchLabSamples,
  fetchLabTechnicians,
  fetchTestResults,
  submitTestResults,
} from "@/services/test-results";
import { formatDate, formatGender, cn } from "@/lib/utils";
import {
  resolveCalculations,
  type ResolvedCalculation,
} from "@/lib/parameter-calculator";
import { invalidateRoots, queryKeys } from "@/lib/query-keys";
import { REFERENCE_MAPPING_LABELS } from "@/types/lab-masters";
import type { BillListParams } from "@/services/billing";
import type { LabBill } from "@/types/billing";
import type {
  BillResultEntry,
  BillTestParameter,
  LabSampleRow,
  LabTestResult,
  ReferenceResolution,
  ResultValue,
} from "@/types/test-result";

type BillMode = "today" | "criteria";

function todayInput(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * The backend decides which reference range applies and, on submit, which flag the
 * result gets. This mirrors that comparison only so the table can give live
 * feedback while a value is being typed; the saved flag always comes back on the
 * stored snapshot.
 */
function previewFlag(
  value: string | number | boolean | null | undefined,
  reference: ReferenceResolution,
): "in-range" | "out-of-range" | "not-comparable" {
  if (typeof value !== "number" || !Number.isFinite(value)) return "not-comparable";
  if (reference.valueType !== "NUMERIC") return "not-comparable";
  if (reference.valueFrom === undefined && reference.valueTo === undefined) {
    return "not-comparable";
  }
  if (reference.valueFrom !== undefined && value < reference.valueFrom) return "out-of-range";
  if (reference.valueTo !== undefined && value > reference.valueTo) return "out-of-range";
  return "in-range";
}

/** Numeric form of what the technician typed, or undefined when not a number. */
function enteredNumber(value: string | boolean | undefined): number | undefined {
  if (typeof value === "boolean") return undefined;
  const raw = (value ?? "").trim();
  if (!raw) return undefined;
  const num = Number(raw.replace(",", "."));
  return Number.isFinite(num) ? num : undefined;
}

/**
 * One line the technician can act on. The backend already knows why a range did
 * or did not apply, so its reason is shown verbatim rather than being guessed at
 * in the browser.
 */
function referenceMessage(reference: ReferenceResolution): string {
  switch (reference.status) {
    case "MATCHED":
      return reference.source === "MAPPING" && reference.mappingType
        ? `Reference source: ${REFERENCE_MAPPING_LABELS[reference.mappingType]}`
        : reference.source === "LEGACY"
          ? "Reference source: Legacy reference range"
          : "Reference source: Generic reference range";
    case "NOT_CONFIGURED":
      return "Reference range not configured for this parameter";
    case "NO_MAPPING_FOR_PATIENT":
      return "Reference range not configured for this patient";
    case "AMBIGUOUS":
      return "More than one configured range matches this patient — select one in Lab Master";
  }
}

function sampleLabel(value: string | undefined): string {
  return value && value.trim() ? value : "—";
}

function toPatientBill(bill: LabBill) {
  return typeof bill.patientId === "object" ? bill.patientId : null;
}

export function ParameterBasedTestResults() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<BillMode>("today");
  const [includeClients, setIncludeClients] = useState(false);
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
  const [printMarked, setPrintMarked] = useState<Record<string, boolean>>({});
  const [signatureId, setSignatureId] = useState<string>("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const billsQuery = useQuery({
    // Registered under the shared `lab-bills` root so that deleting a patient or
    // bill invalidates this list too; an unregistered key stayed cached and kept
    // showing records that no longer existed.
    queryKey: [...queryKeys.labBills, "result-entry", billParams],
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

  // The bill is the authority for what was ordered, and the backend resolves
  // each parameter's reference range for this patient, so the page never
  // re-derives a range in the browser.
  const billEntryQuery = useQuery({
    queryKey: [...queryKeys.testResults, "bill-entry", selectedBill?.id],
    queryFn: () => fetchBillResultEntry(selectedBill?.id as string),
    enabled: Boolean(selectedBill),
  });

  const existingResultsQuery = useQuery({
    queryKey: [...queryKeys.testResults, selectedBill?.id, selectedTestId],
    queryFn: () =>
      selectedBill && selectedTestId
        ? fetchTestResults(selectedBill.id, selectedTestId)
        : Promise.resolve([]),
    enabled: Boolean(selectedBill && selectedTestId),
  });

  const bills = billsQuery.data?.data ?? [];
  const selectedBillTests = selectedBill?.items ?? [];

  const selectedTest = selectedTestId
    ? selectedBillTests.find((item) => item.testId === selectedTestId) ?? null
    : null;

  const selectedTestEntry =
    billEntryQuery.data?.tests.find((test) => test.testId === selectedTestId) ?? null;
  const selectedEntryParameters = selectedTestEntry?.parameters ?? [];

  const patientContext = useMemo(
    () => billEntryQuery.data ?? null,
    [billEntryQuery.data],
  );

  const submitMutation = useMutation({
    mutationFn: submitTestResults,
    onSuccess: (data) => {
      setSuccessMessage(
        `${data.results.length} result${data.results.length === 1 ? "" : "s"} saved for ${selectedTest?.testName ?? "test"}.`,
      );
      // Saved results change the bill's completion state, its samples and the
      // dashboard counters, so every dependent read is invalidated.
      void invalidateRoots(
        queryClient,
        queryKeys.testResults,
        queryKeys.labBills,
        queryKeys.labSamples,
        queryKeys.labTestParameters,
        queryKeys.dashboard,
      );
    },
    onError: (error: Error) => {
      setActionError(error.message || "Failed to submit results.");
    },
  });

  const sampleByTest = useMemo(() => {
    const map = new Map<string, LabSampleRow>();
    for (const row of billSamplesQuery.data?.data ?? []) {
      map.set(row.testId, row);
    }
    return map;
  }, [billSamplesQuery.data]);

  const runSearch = () => {
    const next: BillListParams = { status: "generated", limit: 50 };
    const withClients = includeClients;
    if (!withClients) next.billType = "osp";
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
    setActionError(null);
    setSuccessMessage(null);
  };

  const selectBill = (bill: LabBill) => {
    setSelectedBill(bill);
    setSelectedTestId(bill.items.length > 0 ? bill.items[0].testId : null);
    setPrintMarked({});
    setActionError(null);
    setSuccessMessage(null);
  };

  const selectTest = (testId: string) => {
    setSelectedTestId(testId);
    setActionError(null);
    setSuccessMessage(null);
  };

  return (
    <div className="space-y-3">
      <BillPageHeader
        icon={PenLine}
        title="Enter Test Result"
        subtitle="Enter parameter based test results for a generated lab bill"
        actions={
          <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
            <ClipboardList className="size-3" />
            Test Result
          </Badge>
        }
      />

      {successMessage && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-5">
        <Card className="border-border shadow-sm xl:col-span-3">
          <CardContent className="p-0">
            <div className="border-b border-border px-3 py-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Lab Bills
              </h3>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-2">
                <label className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="billMode"
                    checked={mode === "today"}
                    onChange={() => setMode("today")}
                    className="size-3.5 accent-primary"
                  />
                  Today Lab Bills
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="billMode"
                    checked={mode === "criteria"}
                    onChange={() => setMode("criteria")}
                    className="size-3.5 accent-primary"
                  />
                  Criteria
                </label>
                <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={includeClients}
                    onChange={(event) => setIncludeClients(event.target.checked)}
                    className="size-3.5 accent-primary"
                  />
                  Include Client Bills
                </label>
              </div>
              {mode === "criteria" && (
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="resultFromDate">Bill Date From</Label>
                    <Input
                      id="resultFromDate"
                      type="date"
                      value={fromDate}
                      onChange={(event) => setFromDate(event.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="resultToDate">Bill Date To</Label>
                    <Input
                      id="resultToDate"
                      type="date"
                      value={toDate}
                      onChange={(event) => setToDate(event.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="resultBillNo">Bill No</Label>
                    <Input
                      id="resultBillNo"
                      type="text"
                      placeholder="OSP202600010"
                      value={billNumber}
                      onChange={(event) => setBillNumber(event.target.value)}
                      className="h-8 font-mono uppercase"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="resultPatientName">Patient Name</Label>
                    <Input
                      id="resultPatientName"
                      type="text"
                      placeholder="Search by name"
                      value={patientName}
                      onChange={(event) => setPatientName(event.target.value)}
                      className="h-8"
                    />
                  </div>
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border pt-2">
                <Button type="button" onClick={runSearch} disabled={billsQuery.isFetching}>
                  {billsQuery.isFetching ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Search />
                  )}
                  Search
                </Button>
              </div>
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
                            selected
                              ? "bg-blue-50"
                              : "hover:bg-slate-50",
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
                    <th className="px-3 py-1.5">Print</th>
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
                      <td colSpan={6} className="px-3 py-6 text-center text-xs text-muted-foreground">
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
                          <td className="px-3 py-1.5">
                            <input
                              type="checkbox"
                              aria-label={`Print ${item.testName}`}
                              checked={Boolean(printMarked[item.testId])}
                              onChange={(event) =>
                                setPrintMarked((current) => ({
                                  ...current,
                                  [item.testId]: event.target.checked,
                                }))
                              }
                              onClick={(event) => event.stopPropagation()}
                              className="size-3.5 accent-primary"
                            />
                          </td>
                          <td className="px-3 py-1.5 text-slate-700">{item.departmentName}</td>
                          <td className="px-3 py-1.5">
                            <p className="text-xs font-medium text-slate-800">{item.testName}</p>
                            <p className="font-mono text-[11px] text-muted-foreground">{item.testCode}</p>
                          </td>
                          <td className="px-3 py-1.5 text-slate-700">
                            {sampleLabel(sampleRow?.sampleType)}
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
          <Label htmlFor="signatureSelect" className="text-sm">
            Select Signature to print :
          </Label>
          <Select
            id="signatureSelect"
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

      {selectedBill && selectedTest && billEntryQuery.isError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>
            {billEntryQuery.error instanceof Error
              ? billEntryQuery.error.message
              : "Could not load the bill's tests and reference ranges."}
          </span>
        </div>
      )}

      {selectedBill && selectedTest && !billEntryQuery.isError && (
        <ResultEntryTable
          key={`${selectedBill.id}-${selectedTestId}-${billEntryQuery.dataUpdatedAt ?? 0}-${existingResultsQuery.dataUpdatedAt ?? 0}`}
          parameters={selectedEntryParameters}
          existingResults={existingResultsQuery.data ?? []}
          patient={patientContext}
          testName={selectedTest.testName}
          testCode={selectedTest.testCode}
          testLinked={selectedTestEntry?.testLinked ?? false}
          loading={billEntryQuery.isLoading}
          submitting={submitMutation.isPending}
          onSubmit={(entries) => {
            if (!selectedBill || !selectedTestId) return;
            submitMutation.mutate({
              billId: selectedBill.id,
              testId: selectedTestId,
              entries,
            });
          }}
        />
      )}
    </div>
  );
}

function ResultEntryTable({
  parameters,
  existingResults,
  patient,
  testName,
  testCode,
  testLinked,
  loading,
  submitting,
  onSubmit,
}: {
  parameters: BillTestParameter[];
  existingResults: LabTestResult[];
  patient: BillResultEntry | null;
  testName: string;
  testCode: string;
  testLinked: boolean;
  loading: boolean;
  submitting: boolean;
  onSubmit: (entries: Array<{ parameterId: string; result: ResultValue }>) => void;
}) {
  const [textValues, setTextValues] = useState<Record<string, string>>(() => {
    const existing = new Map(
      existingResults.map((result) => [result.parameterId, result.result]),
    );
    const text: Record<string, string> = {};
    for (const parameter of parameters) {
      const value = existing.get(parameter.parameterId);
      if (parameter.resultType === "BOOLEAN") continue;
      text[parameter.parameterId] =
        typeof value === "string" || typeof value === "number" ? String(value) : "";
    }
    return text;
  });

  const [boolValues, setBoolValues] = useState<Record<string, boolean>>(() => {
    const existing = new Map(
      existingResults.map((result) => [result.parameterId, result.result]),
    );
    const bool: Record<string, boolean> = {};
    for (const parameter of parameters) {
      if (parameter.resultType === "BOOLEAN") {
        bool[parameter.parameterId] = typeof existing.get(parameter.parameterId) === "boolean"
          ? Boolean(existing.get(parameter.parameterId))
          : false;
      }
    }
    return bool;
  });

  const [fieldError, setFieldError] = useState<string | null>(null);

  const showMethod = parameters.some((parameter) =>
    Boolean(parameter.method?.trim()),
  );

  /**
   * Live preview only. The authoritative flag is computed and stored by the
   * backend in the result's reference snapshot, so nothing here decides whether a
   * result is abnormal for good.
   */
  const classificationFor = (parameter: BillTestParameter) =>
    previewFlag(enteredNumber(textValues[parameter.parameterId]), parameter.reference);

  /**
   * Calculators offered for this test. A parameter gets one only when the
   * formula's dependencies are all present in the same test and unambiguous, so
   * the button never appears where it could not compute a correct value.
   */
  const calculations = useMemo(() => {
    const map = new Map<string, ResolvedCalculation>();
    for (const calc of resolveCalculations(
      parameters.map((parameter) => ({
        parameterId: parameter.parameterId,
        parameterName: parameter.parameterName,
      })),
    )) {
      map.set(calc.parameterId, calc);
    }
    return map;
  }, [parameters]);

  const handleCalculate = (calc: ResolvedCalculation) => {
    const values: Record<string, string | number | boolean | undefined> = {};
    for (const parameter of parameters) {
      values[parameter.parameterId] = textValues[parameter.parameterId];
    }
    const result = calc.run(values);
    if (!result.ok) {
      setFieldError(result.error);
      return;
    }
    setFieldError(null);
    // The calculated value is written into the same state the input is bound to,
    // so the live reference check re-runs and the abnormal styling follows
    // immediately. Nothing is saved until the user submits.
    setTextValues((current) => ({
      ...current,
      [calc.parameterId]: String(result.value),
    }));
  };

  const handleSubmit = () => {
    const entries: Array<{ parameterId: string; result: ResultValue }> = [];
    for (const parameter of parameters) {
      if (parameter.resultType === "BOOLEAN") {
        entries.push({ parameterId: parameter.parameterId, result: Boolean(boolValues[parameter.parameterId]) });
        continue;
      }
      const raw = (textValues[parameter.parameterId] ?? "").trim();
      if (!raw) continue;
      if (parameter.resultType === "NUMBER" || parameter.resultType === "RANGE") {
        const numeric = Number(raw);
        if (!Number.isFinite(numeric)) {
          setFieldError(
            `Result for "${parameter.parameterName}" must be a number.`,
          );
          return;
        }
        entries.push({ parameterId: parameter.parameterId, result: numeric });
      } else {
        entries.push({ parameterId: parameter.parameterId, result: raw });
      }
    }
    if (entries.length === 0) {
      setFieldError("Enter at least one result value to save.");
      return;
    }
    setFieldError(null);
    onSubmit(entries);
  };

  const handleClear = () => {
    setTextValues({});
    setFieldError(null);
    const bool: Record<string, boolean> = {};
    for (const parameter of parameters) {
      if (parameter.resultType === "BOOLEAN") bool[parameter.parameterId] = false;
    }
    setBoolValues(bool);
  };

  const renderResultInput = (parameter: BillTestParameter, abnormal: boolean) => {
    const disabled = submitting;
    const flagClasses = abnormal
      ? "border-red-400 bg-red-50/50 text-xs font-bold text-red-600"
      : "";
    switch (parameter.resultType) {
      case "BOOLEAN":
        return (
          <label className="flex w-fit cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(boolValues[parameter.parameterId])}
              onChange={(event) =>
                setBoolValues((current) => ({
                  ...current,
                  [parameter.parameterId]: event.target.checked,
                }))
              }
              disabled={disabled}
              className="size-4 accent-primary"
            />
            <span className="text-sm text-slate-700">
              {boolValues[parameter.parameterId] ? "Positive" : "Negative"}
            </span>
          </label>
        );
      case "SELECT": {
        const options = parameter.options ?? [];
        return (
          <Select
            aria-label={`Result for ${parameter.parameterName}`}
            value={textValues[parameter.parameterId] ?? ""}
            onChange={(event) =>
              setTextValues((current) => ({
                ...current,
                [parameter.parameterId]: event.target.value,
              }))
            }
            disabled={disabled}
            className={cn("h-7 w-40 text-xs", flagClasses)}
          >
            <option value="">Select</option>
            {options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        );
      }
      case "NUMBER":
      case "RANGE":
        return (
          <Input
            type="number"
            inputMode="decimal"
            step="any"
            placeholder="0.00"
            aria-label={`Result for ${parameter.parameterName}`}
            aria-invalid={abnormal || undefined}
            value={textValues[parameter.parameterId] ?? ""}
            onChange={(event) =>
              setTextValues((current) => ({
                ...current,
                [parameter.parameterId]: event.target.value,
              }))
            }
            disabled={disabled}
            className={cn("h-7 w-32 text-xs", flagClasses)}
          />
        );
      case "TEXTAREA":
        return (
          <textarea
            rows={2}
            placeholder="Enter result"
            aria-label={`Result for ${parameter.parameterName}`}
            aria-invalid={abnormal || undefined}
            value={textValues[parameter.parameterId] ?? ""}
            onChange={(event) =>
              setTextValues((current) => ({
                ...current,
                [parameter.parameterId]: event.target.value,
              }))
            }
            disabled={disabled}
            className={cn(
              "w-full min-w-0 resize-y rounded-md border border-input bg-transparent px-2 py-1 text-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring disabled:opacity-50",
              flagClasses,
            )}
          />
        );
      default:
        return (
          <Input
            type="text"
            placeholder="Value"
            aria-label={`Result for ${parameter.parameterName}`}
            aria-invalid={abnormal || undefined}
            value={textValues[parameter.parameterId] ?? ""}
            onChange={(event) =>
              setTextValues((current) => ({
                ...current,
                [parameter.parameterId]: event.target.value,
              }))
            }
            disabled={disabled}
            className={cn("h-7 w-48 text-xs", flagClasses)}
          />
        );
    }
  };

  // Prefer the age the backend actually resolved against, so what the technician
  // sees is exactly what the range was chosen with.
  const ageLabel = (() => {
    const resolved = parameters
      .map((parameter) => parameter.reference.patient.age)
      .find((age): age is { years: number; months: number; days: number } => Boolean(age));
    if (resolved) return `${resolved.years}`;
    if (patient?.patientAge !== undefined && patient?.patientAge !== null) {
      return `${patient.patientAge}`;
    }
    return "—";
  })();

  return (
    <>
      {!testLinked && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>
            Test not linked to a lab test master. No parameters can be entered until the
            test is linked in Billing.
          </span>
        </div>
      )}

      {loading ? (
        <Card className="border-border shadow-sm">
          <CardContent className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading parameters and reference ranges...
          </CardContent>
        </Card>
      ) : (
      <Card className="border-border shadow-sm">
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Test Parameters
            </h3>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-muted-foreground">{testCode}</span>
              <Badge
                variant="outline"
                className="border-primary/20 bg-primary/5 py-0 text-[11px] text-primary"
              >
                {testName}
              </Badge>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 border-b border-border bg-slate-50/60 px-3 py-1 text-[11px] text-slate-600">
            <span className="font-semibold uppercase tracking-wide text-slate-500">
              Patient
            </span>
            <span className="font-mono text-slate-800">{patient?.patientId ?? "—"}</span>
            <span className="font-medium text-slate-800">
              {patient?.patientName ?? "—"}
            </span>
            <span>
              Sex{" "}
              <span className="font-medium text-slate-800">
                {patient ? formatGender(patient.patientGender) : "—"}
              </span>
            </span>
            <span>
              Age <span className="font-medium text-slate-800">{ageLabel}</span>
            </span>
          </div>

          {fieldError && (
            <div
              role="alert"
              className="flex items-center gap-2 border-b border-destructive/20 bg-destructive/5 px-3 py-1.5 text-xs font-medium text-destructive"
            >
              <AlertCircle className="size-3.5 shrink-0" />
              <span>{fieldError}</span>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] table-fixed text-[11px]">
              <colgroup>
                <col className="w-10" />
                <col className="w-32" />
                <col className="w-52" />
                <col className="w-48" />
                <col className="w-20" />
                <col className="w-52" />
                {showMethod ? <col className="w-28" /> : null}
              </colgroup>
              <thead>
                <tr className="bg-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-1">#</th>
                  <th className="px-2 py-1">Lab Test Name</th>
                  <th className="px-2 py-1">Parameter Name</th>
                  <th className="px-2 py-1">Result</th>
                  <th className="px-2 py-1">Units</th>
                  <th className="px-2 py-1">Reference Range</th>
                  {showMethod ? <th className="px-2 py-1">Method</th> : null}
                </tr>
              </thead>
              <tbody>
                {parameters.length === 0 ? (
                  <tr className="border-t border-border">
                    <td
                      colSpan={showMethod ? 7 : 6}
                      className="px-3 py-6 text-center text-xs text-muted-foreground"
                    >
                      No parameters defined for this test
                    </td>
                  </tr>
                ) : (
                  parameters.map((parameter) => {
                    const status = classificationFor(parameter);
                    const abnormal = status === "out-of-range";
                    const message = referenceMessage(parameter.reference);
                    const unresolved =
                      parameter.reference.status !== "MATCHED";
                    return (
                      <tr
                        key={parameter.parameterId}
                        className={cn(
                          "border-t border-border align-top",
                          abnormal && "bg-red-50/40",
                        )}
                      >
                        <td className="px-2 py-1 text-slate-400">
                          {parameter.displayOrder}
                        </td>
                        <td
                          className="truncate px-2 py-1 text-[11px] text-slate-600"
                          title={`${testName} (${testCode})`}
                        >
                          {testName}
                        </td>
                        <td className="px-2 py-1 text-[11px] font-medium text-slate-800">
                          {parameter.parameterName}
                        </td>
                        <td className="px-2 py-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {renderResultInput(parameter, abnormal)}
                            {calculations.has(parameter.parameterId) ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon-sm"
                                className="size-7 shrink-0"
                                title={calculations.get(parameter.parameterId)!.formulaLabel}
                                aria-label={`Calculate ${parameter.parameterName}`}
                                onClick={() =>
                                  handleCalculate(calculations.get(parameter.parameterId)!)
                                }
                                disabled={submitting}
                              >
                                <Calculator className="size-3.5" />
                              </Button>
                            ) : null}
                            {abnormal ? (
                              <span
                                role="status"
                                className="rounded bg-red-100 px-1 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700"
                              >
                                Abnormal
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-2 py-1 text-slate-600">
                          {sampleLabel(parameter.unit)}
                        </td>
                        <td className="px-2 py-1">
                          {unresolved ? (
                            <span
                              className="block rounded bg-amber-100 px-1 text-[10px] font-semibold text-amber-800"
                              title={parameter.reference.reason}
                            >
                              {message}
                            </span>
                          ) : (
                            <>
                              <span className="whitespace-pre-line text-slate-700">
                                {parameter.reference.displayValue || "—"}
                              </span>
                              <span
                                className="mt-0.5 block text-[10px] uppercase tracking-wide text-slate-500"
                                title={parameter.reference.reason}
                              >
                                {message}
                              </span>
                              {parameter.reference.source === "LEGACY" ? (
                                <span className="mt-0.5 block text-[10px] italic text-slate-400">
                                  Legacy reference — verify against the source report
                                </span>
                              ) : null}
                            </>
                          )}
                        </td>
                        {showMethod ? (
                          <td className="px-2 py-1 text-slate-600">
                            {sampleLabel(parameter.method)}
                          </td>
                        ) : null}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      )}

      <BillActionBar
        submitLabel="Submit"
        submitIcon={<PenLine />}
        submitting={submitting}
        submitDisabled={parameters.length === 0 || !testLinked}
        onSubmit={handleSubmit}
        onClear={handleClear}
      />
    </>
  );
}

export default ParameterBasedTestResults;