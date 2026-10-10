"use client";

import { useState } from "react";
import Link from "next/link";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  Loader2,
  RotateCcw,
  Save,
  Search,
  Unlink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BillPageHeader } from "@/components/billing/bill-page-header";
import { fetchLabSamples, updateSampleStatus } from "@/services/test-results";
import { cn, formatDate } from "@/lib/utils";
import { invalidateRoots, queryKeys } from "@/lib/query-keys";
import { matchesSampleContext, resultContextHref, type SampleContext } from "@/lib/lab-workflows";
import {
  SAMPLE_STATUSES,
  type LabSampleRow,
  type SampleListMode,
  type SampleListParams,
  type SampleStatus,
} from "@/types/test-result";

const EDITABLE_STATUSES: SampleStatus[] = SAMPLE_STATUSES.filter(
  (status) => status !== "SELECT",
);

interface RowDraft {
  status: SampleStatus;
  time: string;
  comments: string;
}

function todayInput(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function currentTimeInput(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

const STATUS_STYLES: Record<SampleStatus, { chip: string; row: string; label: string }> = {
  // Strong, dark, saturated status colours so each state is unmistakable at a
  // glance: successful processing is deep green, rejection is deep red, an
  // untouched row is a neutral dark grey. White text keeps the chip readable,
  // and the status word is always shown as well as the colour.
  SELECT: { chip: "bg-slate-600 text-white", row: "bg-white", label: "Not Updated" },
  COLLECTED: { chip: "bg-green-700 text-white", row: "bg-green-100/70", label: "Collected" },
  RECEIVED: { chip: "bg-green-800 text-white", row: "bg-green-100/70", label: "Received" },
  PROCESSED: { chip: "bg-green-900 text-white", row: "bg-green-200/60", label: "Processed" },
  RECOLLECTED: { chip: "bg-teal-800 text-white", row: "bg-teal-100/70", label: "Recollected" },
  REJECTED: { chip: "bg-red-800 text-white", row: "bg-red-100/70", label: "Rejected" },
};

export function SampleCollections({ context }: { context?: SampleContext }) {
  const queryClient = useQueryClient();
  const [activeContext, setActiveContext] = useState(context);
  const [mode, setMode] = useState<SampleListMode>(context ? "criteria" : "today");
  const [billNumber, setBillNumber] = useState(context?.billNumber ?? "");
  const [patientId, setPatientId] = useState("");
  const [patientName, setPatientName] = useState("");
  const [fromDate, setFromDate] = useState(todayInput);
  const [toDate, setToDate] = useState(todayInput);
  const [params, setParams] = useState<SampleListParams>(context ? { mode: "criteria", billNumber: context.billNumber, limit: 100 } : { mode: "today" });
  const [savingId, setSavingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const samplesQuery = useQuery({
    queryKey: ["lab-samples", params],
    queryFn: () => fetchLabSamples(params),
    enabled: Boolean(params.mode),
  });

  const saveMutation = useMutation({
    mutationFn: ({ id, draft }: { id: string; draft: RowDraft }) =>
      updateSampleStatus(id, {
        status: draft.status,
        time: draft.time || undefined,
        comments: draft.comments.trim() || undefined,
      }),
    onSuccess: (updated) => {
      setSuccessMessage(
        `Sample ${updated.sampleId} (${updated.testName ?? "test"}) — ${statusLabel(updated.sampleStatus)}.`,
      );
      // A sample status change is visible on the sample screens and on the
      // result-entry / reprint bill lists, and it moves the dashboard counters.
      void invalidateRoots(
        queryClient,
        queryKeys.labSamples,
        queryKeys.labBills,
        queryKeys.dashboard,
      );
    },
    onError: (error: Error) => {
      setActionError(error.message || "Failed to update the sample status.");
    },
  });

  const onSaveSample = (id: string, draft: RowDraft) => {
    setSavingId(id);
    setActionError(null);
    setSuccessMessage(null);
    saveMutation.mutate({ id, draft }, { onSettled: () => setSavingId(null) });
  };

  const rows = (samplesQuery.data?.data ?? []).filter((row) => matchesSampleContext(row, activeContext));
  const billTotal = samplesQuery.data?.pagination.total ?? 0;
  const totalPages = samplesQuery.data?.pagination.totalPages ?? 1;
  const currentPage = samplesQuery.data?.pagination.page ?? params.page ?? 1;
  const loadedSampleCount =
    activeContext ? rows.length : samplesQuery.data?.pagination.sampleCount ?? rows.length;

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) return;
    setParams((previous) => ({ ...previous, page }));
    setActionError(null);
    setSuccessMessage(null);
  };

  const runSearch = () => {
    setActiveContext(undefined);
    const nextParams: SampleListParams = { mode, page: 1, limit: 100 };
    if (mode === "criteria") {
      if (fromDate) nextParams.fromDate = fromDate;
      if (toDate) nextParams.toDate = toDate;
      const bill = billNumber.trim();
      const pId = patientId.trim();
      const pName = patientName.trim();
      if (bill) nextParams.billNumber = bill;
      if (pId) nextParams.patientId = pId;
      if (pName) nextParams.patientName = pName;
    }
    setParams(nextParams);
    setActionError(null);
    setSuccessMessage(null);
  };

  const handleModeChange = (next: SampleListMode) => {
    setActiveContext(undefined);
    setMode(next);
    setParams({ mode: next, page: 1, limit: 100 });
    if (next === "criteria") {
      setFromDate(todayInput());
      setToDate(todayInput());
    } else {
      setBillNumber("");
      setPatientId("");
      setPatientName("");
    }
    setActionError(null);
    setSuccessMessage(null);
  };

  const handleClear = () => {
    setActiveContext(undefined);
    setMode("today");
    setBillNumber("");
    setPatientId("");
    setPatientName("");
    setFromDate(todayInput());
    setToDate(todayInput());
    setParams({ mode: "today", page: 1, limit: 100 });
    setActionError(null);
    setSuccessMessage(null);
  };

  return (
    <div className="lis-samples space-y-3">
      <BillPageHeader
        icon={FlaskConical}
        title="Lab Sample Collection Status"
        subtitle="Track collection, receipt, processing and rejection of lab samples"
        actions={
          <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
            <FlaskConical className="size-3" />
            Test Result
          </Badge>
        }
      />



      {context && <div className="flex items-center justify-between border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
        <span>{activeContext ? "Selected sample for bill" : "Opened from bill"} {context.billNumber}</span>
        <div className="flex gap-2">
          <Link href={resultContextHref(context)} className="lis-sample-return inline-flex items-center gap-1 rounded border border-primary bg-primary px-3 py-1.5 font-semibold text-white"><RotateCcw className="size-4" />Return</Link>
          {activeContext && <Button variant="outline" size="sm" onClick={handleClear}>View all samples</Button>}
        </div>
      </div>}
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

      <Card className="border-border shadow-sm">
        <CardContent className="lis-sample-filters space-y-3 p-3">
      <div className="lis-sample-legend flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        {EDITABLE_STATUSES.map((status) => (
          <span key={status} className="flex items-center gap-1.5">
            <span className={`size-2.5 rounded-full ${STATUS_STYLES[status].chip}`} />
            {STATUS_STYLES[status].label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-slate-600" />
          Not Updated
        </span>
      </div>
          <fieldset>
            <legend className="sr-only">Sample collection filter</legend>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <label className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-700">
                <input
                  type="radio"
                  name="sampleMode"
                  checked={mode === "today"}
                  onChange={() => handleModeChange("today")}
                  className="size-3.5 accent-primary"
                />
                Today Lab Bills
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-700">
                <input
                  type="radio"
                  name="sampleMode"
                  checked={mode === "criteria"}
                  onChange={() => handleModeChange("criteria")}
                  className="size-3.5 accent-primary"
                />
                Criteria
              </label>
            </div>
          </fieldset>

          {mode === "criteria" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="sampleBillNo">Bill No</Label>
                <Input
                  id="sampleBillNo"
                  type="text"
                  value={billNumber}
                  onChange={(event) => setBillNumber(event.target.value)}
                  className="h-8 font-mono uppercase"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="samplePatientId">Patient Id</Label>
                <Input
                  id="samplePatientId"
                  type="text"
                  value={patientId}
                  onChange={(event) => setPatientId(event.target.value)}
                  className="h-8 font-mono uppercase"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="samplePatientName">Patient Name</Label>
                <Input
                  id="samplePatientName"
                  type="text"
                  value={patientName}
                  onChange={(event) => setPatientName(event.target.value)}
                  className="h-8"
                />
              </div>
              <div className="flex items-end gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="sampleFromDate">Bill Date From</Label>
                  <Input
                    id="sampleFromDate"
                    type="date"
                    value={fromDate}
                    onChange={(event) => setFromDate(event.target.value)}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sampleToDate">Bill Date To</Label>
                  <Input
                    id="sampleToDate"
                    type="date"
                    value={toDate}
                    onChange={(event) => setToDate(event.target.value)}
                    className="h-8"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <Button
              type="button"
              onClick={runSearch}
              disabled={samplesQuery.isFetching}
            >
              {samplesQuery.isFetching ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search />
              )}
              Search
            </Button>
            <Button type="button" variant="outline" onClick={handleClear} disabled={samplesQuery.isFetching}>
              <RotateCcw />
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm">
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Lab Samples
            </h3>
            {samplesQuery.data && (
              <span className="text-xs text-muted-foreground">
                {loadedSampleCount} sample{loadedSampleCount === 1 ? "" : "s"} loaded from{" "}
                {billTotal} bill{billTotal === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-1.5">S.No</th>
                  <th className="px-3 py-1.5">Bill No</th>
                  <th className="px-3 py-1.5">Bill Date</th>
                  <th className="px-3 py-1.5">Patient Id</th>
                  <th className="px-3 py-1.5">Patient Name</th>
                  <th className="px-3 py-1.5">Department</th>
                  <th className="px-3 py-1.5">Test Name</th>
                  <th className="px-3 py-1.5">Test Status</th>
                  <th className="px-3 py-1.5">Sample Status</th>
                  <th className="px-3 py-1.5">Time</th>
                  <th className="px-3 py-1.5">Comments</th>
                  <th className="px-3 py-1.5">Action</th>
                </tr>
              </thead>
              <tbody>
                {samplesQuery.isLoading ? (
                  <tr className="border-t border-border">
                    <td colSpan={12} className="px-3 py-6 text-center text-xs text-muted-foreground">
                      Loading samples…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr className="border-t border-border">
                    <td colSpan={12} className="px-3 py-6 text-center text-xs text-muted-foreground">
                      No Records To Display
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <SampleRow
                      key={`${row.id}-${samplesQuery.dataUpdatedAt ?? 0}`}
                      row={row}
                      index={index}
                      isSaving={savingId !== null}
                      isThisSaving={savingId === row.id}
                      onSave={onSaveSample}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-3 py-2">
              <span className="text-xs text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={currentPage <= 1 || samplesQuery.isFetching}
                  onClick={() => goToPage(currentPage - 1)}
                >
                  <ChevronLeft className="size-3.5" />
                  Previous
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={currentPage >= totalPages || samplesQuery.isFetching}
                  onClick={() => goToPage(currentPage + 1)}
                >
                  Next
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SampleRow({
  row,
  index,
  isSaving,
  isThisSaving,
  onSave,
}: {
  row: LabSampleRow;
  index: number;
  isSaving: boolean;
  isThisSaving: boolean;
  onSave: (id: string, draft: RowDraft) => void;
}) {
  const [draft, setDraft] = useState<RowDraft>(() => ({
    status: row.sampleStatus,
    time: currentTimeInput(),
    comments: row.comments ?? "",
  }));

  const editDraft = (patch: Partial<RowDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));

  const statusStyle = STATUS_STYLES[draft.status];
  const save = !draft || draft.status === "SELECT" || draft.status === row.sampleStatus || isSaving;

  return (
    <tr className={`border-t border-border ${statusStyle.row}`}>
      <td className="px-3 py-1.5 text-slate-500">{index + 1}</td>
      <td className="px-3 py-1.5 font-mono font-medium text-slate-800">{row.billNumber}</td>
      <td className="px-3 py-1.5 text-slate-600">
        {row.billDate ? formatDate(row.billDate) : "—"}
      </td>
      <td className="px-3 py-1.5 font-mono text-slate-700">{row.patientCode ?? "—"}</td>
      <td className="px-3 py-1.5 font-medium text-slate-800">{row.patientName ?? "—"}</td>
      <td className="px-3 py-1.5 text-slate-700">{row.departmentName ?? "—"}</td>
      <td className="px-3 py-1.5 align-top">
        {row.testLinked === false || !row.testName ? (
          <span className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[13px] font-medium text-amber-800">
            <Unlink className="size-3 shrink-0" />
            Test not linked
          </span>
        ) : (
          <>
            <p className="max-w-[16rem] break-words text-xs font-medium text-slate-800">
              {row.testName}
            </p>
            {row.testCode && (
              <p className="font-mono text-[11px] text-muted-foreground">{row.testCode}</p>
            )}
            {row.testNameFromBillItem === false && (
              <p className="text-[11px] text-muted-foreground">From test master</p>
            )}
          </>
        )}
      </td>
      <td className="px-3 py-1.5">
        <Badge
          variant="outline"
          className={
            row.testStatus === "CLOSED"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-slate-200 bg-slate-50 text-slate-600"
          }
        >
          {row.testStatus}
        </Badge>
      </td>
      <td className="px-3 py-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "shrink-0 rounded px-1.5 py-0.5 text-[13px] font-medium",
              STATUS_STYLES[row.sampleStatus].chip,
            )}
          >
            {STATUS_STYLES[row.sampleStatus].label}
          </span>
          <Select
            aria-label={`Sample status for ${row.sampleId}`}
            value={draft.status}
            onChange={(event) => editDraft({ status: event.target.value as SampleStatus })}
            disabled={isSaving}
            className="h-8 w-36"
          >
          <option value="SELECT">Not Updated</option>
          {EDITABLE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_STYLES[status].label}
            </option>
          ))}
        </Select>
        </div>
      </td>
      <td className="px-3 py-1.5">
        <Input
          type="time"
          aria-label={`Collection time for ${row.sampleId}`}
          value={draft.time}
          onChange={(event) => editDraft({ time: event.target.value })}
          disabled={isSaving}
          className="h-8 w-28"
        />
      </td>
      <td className="px-3 py-1.5">
        <Input
          type="text"
          aria-label={`Comments for ${row.sampleId}`}
          maxLength={500}
          value={draft.comments}
          onChange={(event) => editDraft({ comments: event.target.value })}
          disabled={isSaving}
          className="h-8 w-36"
        />
      </td>
      <td className="px-3 py-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={save}
          onClick={() => onSave(row.id, draft)}
        >
          {isThisSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          Save
        </Button>
      </td>
    </tr>
  );
}

function statusLabel(status: SampleStatus): string {
  return STATUS_STYLES[status]?.label ?? status;
}

export default SampleCollections;
