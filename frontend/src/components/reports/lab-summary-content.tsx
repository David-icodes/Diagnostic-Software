"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { localToday } from "@/lib/report-filter-state";
import { Badge } from "@/components/ui/badge";
import { ReportDateRange } from "@/components/reports/report-date-range";
import { ReportSearchInput } from "@/components/reports/report-search-input";
import { ReportSelect } from "@/components/reports/report-select";
import { ReportFilterBar } from "@/components/reports/report-filter-bar";
import {
  REPORT_EMPTY_MESSAGE,
  ReportTable,
  type ReportColumn,
} from "@/components/reports/report-table";
import {
  REPORT_EM_DASH as EM_DASH,
  ReportTruncatedCell,
} from "@/components/reports/report-truncated-cell";
import { ReportTitleBar } from "@/components/reports/report-title-bar";
import { ReportPreview } from "@/components/reports/report-preview";
import { ReportToolbar } from "@/components/reports/report-toolbar";
import { ReportSelectionPanel } from "@/components/reports/report-selection-panel";
import { ReportPrintSheet, type PrintColumn } from "@/components/reports/report-print-sheet";
import { useReportFind } from "@/components/reports/use-report-find";
import {
  formatCriteriaDate,
  downloadCsv,
  reportCsvName,
} from "@/components/reports/report-export";
import { fetchDepartments, fetchLabTests } from "@/services/billing";
import { fetchLabSummary } from "@/services/reports";
import {
  APPROVAL_STATUS_OPTIONS,
  LAB_STATUS_OPTIONS,
  REPORT_PATIENT_TYPE_OPTIONS,
  patientTypeLabel,
} from "@/types/reports";
import type {
  LabSummaryReportRow,
  LabSummaryResponse,
  ReportSelectOption,
} from "@/types/reports";
import { formatDate, formatDateTime, formatMoney } from "@/lib/utils";

const PRESET_LIMIT = 20;

/** Keeps the summary grid (plus its header) at roughly half a desktop viewport. */
const TABLE_SCROLL_AREA = "max-h-[min(48vh,560px)]";

/** Test option that remembers its department so the panel can be scoped. */
type TestOption = ReportSelectOption & { departmentId: string };

interface Filters {
  fromDate: string;
  toDate: string;
  departmentIds: string[];
  testIds: string[];
  patientTypes: string[];
  billNumber: string;
  labStatus: string;
  approvalStatus: string;
  delayedTat: boolean;
}

const EMPTY_FILTERS: Filters = {
  fromDate: "",
  toDate: "",
  departmentIds: [],
  testIds: [],
  patientTypes: [],
  billNumber: "",
  labStatus: "",
  approvalStatus: "",
  delayedTat: false,
};

export function LabSummaryContent() {
  const [filters, setFilters] = useState<Filters>(() => ({ ...EMPTY_FILTERS, fromDate: localToday(), toDate: localToday() }));
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [departments, setDepartments] = useState<ReportSelectOption[]>([]);
  const [tests, setTests] = useState<TestOption[]>([]);
  const [result, setResult] = useState<LabSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printRows, setPrintRows] = useState<LabSummaryReportRow[]>([]);
  const [printing, setPrinting] = useState(false);
  const requestSequence = useRef(0);

  useEffect(() => {
    Promise.all([
      fetchDepartments().then((rows) =>
        rows
          .filter((row) => row.active !== false)
          .map((row) => ({ value: row.id, label: row.name }))
          .sort((a, b) => a.label.localeCompare(b.label)),
      ),
      fetchLabTests({ limit: 1000, status: "active" }).then((res) =>
        res.items
          .filter((row) => row.active !== false)
          .map((row) => ({
            value: row.id,
            label: row.testName,
            departmentId: row.departmentId,
          }))
          .sort((a, b) => a.label.localeCompare(b.label)),
      ),
    ])
      .then(([deptRows, testRows]) => {
        setDepartments(deptRows);
        setTests(testRows);
      })
      .catch(() => {
        setDepartments([]);
        setTests([]);
      });
  }, []);

  const buildParams = useCallback(
    (targetPage: number, criteria: Filters) =>
      ({
        page: targetPage,
        limit: PRESET_LIMIT,
        fromDate: criteria.fromDate || undefined,
        toDate: criteria.toDate || undefined,
        departmentIds: criteria.departmentIds.length
          ? criteria.departmentIds.join(",")
          : undefined,
        testIds: criteria.testIds.length ? criteria.testIds.join(",") : undefined,
        patientTypes: criteria.patientTypes.length
          ? criteria.patientTypes.join(",")
          : undefined,
        billNumber: criteria.billNumber.trim() || undefined,
        labStatus: (criteria.labStatus || undefined) as
          | "OPEN"
          | "CLOSED"
          | undefined,
        approvalStatus: (criteria.approvalStatus || undefined) as
          | "PENDING"
          | "APPROVED"
          | undefined,
        delayedTat: criteria.delayedTat ? ("1" as const) : undefined,
      }) satisfies Parameters<typeof fetchLabSummary>[0],
    [],
  );

  const runExport = useCallback(
    (criteria: Filters) =>
      fetchLabSummary({ ...buildParams(1, criteria), export: "1" }).then(
        (response) => response.data,
      ),
    [buildParams],
  );

  const runFetch = useCallback(
    (targetPage: number, criteria: Filters) => {
      const request = ++requestSequence.current;
      fetchLabSummary(buildParams(targetPage, criteria))
        .then((response) => {
          if (request !== requestSequence.current) return;
          setResult(response);
          setError(null);
        })
        .catch(() => {
          if (request !== requestSequence.current) return;
          setResult(null);
          setError("Unable to load the report. Please try again.");
        })
        .finally(() => { if (request === requestSequence.current) setLoading(false); });
    },
    [buildParams],
  );

  const handleSearch = useCallback(() => {
    setApplied(filters);
    setLoading(true);
    runFetch(1, filters);
  }, [filters, runFetch]);

  const handleClear = useCallback(() => {
    requestSequence.current += 1;
    setFilters({ ...EMPTY_FILTERS, fromDate: localToday(), toDate: localToday() });
    setApplied(EMPTY_FILTERS);
    setLoading(false);
    setResult(null);
    setError(null);
  }, []);

  const handlePageChange = useCallback(
    (targetPage: number) => {
      setLoading(true);
      runFetch(targetPage, applied);
    },
    [applied, runFetch],
  );

  const setFilter = useCallback((key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleSelection = useCallback((key: "departmentIds" | "testIds" | "patientTypes", value: string) => {
    setFilters((prev) => {
      const current = prev[key];
      const next = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];
      return { ...prev, [key]: next };
    });
  }, []);

  const selectAll = useCallback((key: "departmentIds" | "testIds" | "patientTypes", values: string[]) => {
    setFilters((prev) => ({ ...prev, [key]: values }));
  }, []);

  const clearSelections = useCallback((key: "departmentIds" | "testIds" | "patientTypes") => {
    setFilters((prev) => ({ ...prev, [key]: [] }));
  }, []);

  const rows = useMemo(() => result?.data ?? [], [result]);

  const currentPage = result?.pagination.page ?? 1;
  const serialById = useMemo(() => {
    const start = (currentPage - 1) * PRESET_LIMIT;
    return new Map(rows.map((row, index) => [row.id, start + index + 1]));
  }, [currentPage, rows]);

  const find = useReportFind<LabSummaryReportRow>(rows, (row) => [
    row.billNumber,
    row.patientName,
    row.patientId,
    row.departmentName,
    row.testName,
    row.upId,
    row.sampleStatus,
    row.enteredBy,
    row.labStatus,
    row.approvalStatus,
    row.delayedTat ? "delayed yes" : "delay no",
  ]);

  /** Tests are scoped to the departments currently ticked in the filter. */
  const scopedTestOptions = useMemo(
    () =>
      filters.departmentIds.length === 0
        ? tests
        : tests.filter((test) => filters.departmentIds.includes(test.departmentId)),
    [filters.departmentIds, tests],
  );

  const summaryLine = useMemo(() => {
    if (!result) return "";
    return [
      `Total Tests : ${result.summary.totalTests}`,
      `Delayed TAT : ${result.summary.totalDelayed}`,
      `Total Amount : ${formatMoney(result.summary.totalAmount)}`,
    ].join("  ·  ");
  }, [result]);

  const printSummaryLine = result
    ? `${summaryLine} · Income : ${formatMoney(result.summary.income)} · Due : ${formatMoney(result.summary.due)} (${result.summary.totalBills} whole bills) · Profit : unavailable (expense calculation unavailable)`
    : "";

  const columns: ReportColumn<LabSummaryReportRow>[] = useMemo(
    () => [
      {
        key: "sNo",
        header: "S No",
        className: "w-12",
        align: "center",
        render: (row) => serialById.get(row.id) ?? "",
      },
      {
        key: "billNumber",
        header: "Bill No",
        className: "w-32 whitespace-nowrap font-medium text-slate-800",
        render: (row) => row.billNumber,
      },
      {
        key: "reportDate",
        header: "Report Date",
        className: "w-24 whitespace-nowrap",
        render: (row) => formatDate(row.reportDate),
      },
      {
        key: "patientId",
        header: "GPId",
        className: "w-28 whitespace-nowrap",
        render: (row) => row.patientId,
      },
      {
        key: "patientName",
        header: "Patient Name",
        className: "w-40",
        render: (row) => (
          <ReportTruncatedCell value={row.patientName} className="font-medium" />
        ),
      },
      {
        key: "patientType",
        header: "Patient Type",
        className: "w-24",
        render: (row) => patientTypeLabel(row.patientType),
      },
      {
        key: "department",
        header: "Department",
        className: "w-32",
        render: (row) => <ReportTruncatedCell value={row.departmentName} />,
      },
      {
        key: "test",
        header: "Test Name",
        className: "w-44",
        render: (row) => <ReportTruncatedCell value={row.testName} />,
      },
      {
        key: "upId",
        header: "UPId",
        className: "w-28 whitespace-nowrap",
        render: (row) => <ReportTruncatedCell value={row.upId} />,
      },
      {
        key: "sampleStatus",
        header: "Sample Status",
        className: "w-28",
        render: (row) => <ReportTruncatedCell value={row.sampleStatus} />,
      },
      {
        key: "collectedOn",
        header: "Collected On",
        className: "w-32 whitespace-nowrap",
        render: (row) =>
          row.collectedOn ? (
            formatDateTime(row.collectedOn)
          ) : (
            <span className="text-muted-foreground">{EM_DASH}</span>
          ),
      },
      {
        key: "labStatus",
        header: "Lab Status",
        className: "w-24 text-center",
        align: "center",
        render: (row) =>
          row.labStatus === "CLOSED" ? (
            <Badge variant="outline" className="border-emerald-200 text-emerald-600">
              CLOSED
            </Badge>
          ) : (
            <Badge variant="outline" className="border-slate-300 text-slate-600">
              OPEN
            </Badge>
          ),
      },
      {
        key: "approvalStatus",
        header: "Approval Status",
        className: "w-28 text-center",
        align: "center",
        render: (row) =>
          row.approvalStatus === "APPROVED" ? (
            <Badge variant="outline" className="border-emerald-200 text-emerald-600">
              APPROVED
            </Badge>
          ) : (
            <Badge variant="outline" className="border-amber-200 text-amber-600">
              PENDING
            </Badge>
          ),
      },
      {
        // The LIS has no approval workflow yet, so no approver is recorded. The
        // column is kept for layout parity and always shows the em dash rather
        // than inventing a name.
        key: "approvedBy",
        header: "Approved By",
        className: "w-28",
        render: () => <span className="text-muted-foreground">{EM_DASH}</span>,
      },
      {
        key: "approvedOn",
        header: "Approved On",
        className: "w-32",
        render: () => <span className="text-muted-foreground">{EM_DASH}</span>,
      },
      {
        key: "enteredBy",
        header: "Entered By",
        className: "w-32",
        render: (row) => <ReportTruncatedCell value={row.enteredBy} />,
      },
      {
        key: "enteredOn",
        header: "Entered On",
        className: "w-32 whitespace-nowrap",
        render: (row) =>
          row.enteredOn ? (
            formatDateTime(row.enteredOn)
          ) : (
            <span className="text-muted-foreground">{EM_DASH}</span>
          ),
      },
      {
        key: "delayedTat",
        header: "Delayed TAT",
        className: "w-24 text-center",
        align: "center",
        render: (row) =>
          row.delayedTat ? (
            <Badge variant="outline" className="border-red-200 text-red-600">
              YES
            </Badge>
          ) : (
            <span className="text-muted-foreground">No</span>
          ),
      },
      {
        key: "amount",
        header: "Amount",
        className: "w-24 whitespace-nowrap text-right",
        align: "right",
        render: (row) => formatMoney(row.amount),
      },
    ],
    [serialById],
  );

  const printColumns: PrintColumn<LabSummaryReportRow>[] = useMemo(
    () => [
      { key: "billNumber", header: "Bill No", render: (row) => row.billNumber },
      { key: "reportDate", header: "Report Date", render: (row) => formatDate(row.reportDate) },
      { key: "patientId", header: "GPId", render: (row) => row.patientId },
      { key: "patientName", header: "Patient Name", render: (row) => row.patientName },
      { key: "patientType", header: "Patient Type", render: (row) => patientTypeLabel(row.patientType) },
      { key: "department", header: "Department", render: (row) => row.departmentName },
      { key: "test", header: "Test Name", render: (row) => row.testName },
      { key: "upId", header: "UPId", render: (row) => row.upId || EM_DASH },
      { key: "sampleStatus", header: "Sample Status", render: (row) => row.sampleStatus || EM_DASH },
      {
        key: "collectedOn",
        header: "Collected On",
        render: (row) => (row.collectedOn ? formatDateTime(row.collectedOn) : EM_DASH),
      },
      { key: "labStatus", header: "Lab Status", render: (row) => row.labStatus },
      { key: "approvalStatus", header: "Approval Status", render: (row) => row.approvalStatus },
      { key: "approvedBy", header: "Approved By", render: () => EM_DASH },
      { key: "approvedOn", header: "Approved On", render: () => EM_DASH },
      { key: "enteredBy", header: "Entered By", render: (row) => row.enteredBy || EM_DASH },
      {
        key: "enteredOn",
        header: "Entered On",
        render: (row) => (row.enteredOn ? formatDateTime(row.enteredOn) : EM_DASH),
      },
      {
        key: "delayedTat",
        header: "Delayed TAT",
        render: (row) => (row.delayedTat ? "Yes" : "No"),
      },
      {
        key: "amount",
        header: "Amount (Rs.)",
        render: (row) => formatMoney(row.amount),
        align: "right",
      },
    ],
    [],
  );

  const criteriaText = useMemo(() => {
    const parts = [];
    const from = formatCriteriaDate(applied.fromDate);
    const to = formatCriteriaDate(applied.toDate);
    parts.push(`Apply Date : ${from || "—"} To ${to || "—"}`);
    if (applied.departmentIds.length) {
      parts.push(
        `Department : ${applied.departmentIds
          .map((id) => departments.find((d) => d.value === id)?.label ?? id)
          .join(", ")}`,
      );
    }
    if (applied.testIds.length) {
      parts.push(
        `Test : ${applied.testIds
          .map((id) => tests.find((t) => t.value === id)?.label ?? id)
          .join(", ")}`,
      );
    }
    if (applied.patientTypes.length) {
      parts.push(
        `Patient Type : ${applied.patientTypes
          .map((type) => REPORT_PATIENT_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type)
          .join(", ")}`,
      );
    }
    if (applied.billNumber) parts.push(`Bill No : ${applied.billNumber}`);
    if (applied.labStatus) parts.push(`Lab Status : ${applied.labStatus}`);
    if (applied.approvalStatus) parts.push(`Approval Status : ${applied.approvalStatus}`);
    if (applied.delayedTat) parts.push("Delayed TAT : Yes");
    return parts.join("  |  ");
  }, [applied, departments, tests]);

  const handleExport = useCallback(() => {
    if (!result) return;
    runExport(applied)
      .then((rows) => {
        downloadCsv(
          reportCsvName("lab-summary-report"),
          printColumns.map((column) => column.header),
          rows.map((row) => printColumns.map((column) => column.render(row))),
        );
      })
      .catch(() => setError("Unable to export the report. Please try again."));
  }, [result, applied, runExport, printColumns]);

  const handlePrint = useCallback(() => {
    if (!result || printing) return;
    setPrinting(true);
    runExport(applied)
      .then((rows) => {
        setPrintRows(rows);
        window.setTimeout(() => window.print(), 0);
      })
      .catch(() => setError("Unable to print the report. Please try again."))
      .finally(() => setPrinting(false));
  }, [result, applied, runExport, printing]);

  /** Amount is the only additive column, so the printed total lands on it. */
  const printTotals = useMemo(
    () =>
      printColumns.map((column) =>
        column.key === "amount" ? formatMoney(result?.summary.totalAmount ?? 0) : "",
      ),
    [printColumns, result],
  );

  return (
    <>
      <div data-tmis-page="lab-summary" className="lis-tmis lis-report-page flex flex-col gap-2 print:hidden">
        <ReportTitleBar
          title="Lab Summary Report"
          subtitle="Per-test lab status, sample workflow, result entry and delayed TAT."
        />

        <ReportFilterBar
          compact
          onSearch={handleSearch}
          onClear={handleClear}
          searching={loading}
        >
          <div className="lis-summary-layout grid gap-2">
<div className="lis-summary-lists grid grid-cols-1 gap-2 sm:grid-cols-2">
            <ReportSelectionPanel
              bare
              title="Department"
              selectAllLabel="All"
              options={departments}
              selected={filters.departmentIds}
              onToggle={(value) => toggleSelection("departmentIds", value)}
              onSelectAll={(values) => selectAll("departmentIds", values)}
              onClear={() => clearSelections("departmentIds")}
              searchPlaceholder="Search department…"
              maxHeightClassName="max-h-32"
            />
            <ReportSelectionPanel
              bare
              title="Test"
              selectAllLabel="All"
              options={scopedTestOptions}
              selected={filters.testIds}
              onToggle={(value) => toggleSelection("testIds", value)}
              onSelectAll={(values) => selectAll("testIds", values)}
              onClear={() => clearSelections("testIds")}
              searchPlaceholder="Search Test"
              maxHeightClassName="max-h-32"
            />
            
          </div>
<div className="lis-summary-criteria grid grid-cols-2 gap-2">
            <ReportDateRange
              fromId="ls-from-date"
              toId="ls-to-date"
              fromValue={filters.fromDate}
              toValue={filters.toDate}
              onFromChange={(value) => setFilter("fromDate", value)}
              onToChange={(value) => setFilter("toDate", value)}
            />
            <ReportSelectionPanel
              bare
              title="Patient Type"
              selectAllLabel="All"
              options={REPORT_PATIENT_TYPE_OPTIONS}
              selected={filters.patientTypes}
              onToggle={(value) => toggleSelection("patientTypes", value)}
              onSelectAll={(values) => selectAll("patientTypes", values)}
              onClear={() => clearSelections("patientTypes")}
              searchPlaceholder="Search patient type…"
              maxHeightClassName="max-h-32"
            />
<ReportSearchInput
              id="ls-bill-number"
              label="Bill Number"
              value={filters.billNumber}
              onChange={(value) => setFilter("billNumber", value)}
              placeholder="e.g. OSP202600001"
            />
            <ReportSelect
              id="ls-lab-status"
              label="Lab Status"
              value={filters.labStatus}
              onChange={(value) => setFilter("labStatus", value)}
              options={LAB_STATUS_OPTIONS}
            />
            <ReportSelect
              id="ls-approval-status"
              label="Approval Status"
              value={filters.approvalStatus}
              onChange={(value) => setFilter("approvalStatus", value)}
              options={APPROVAL_STATUS_OPTIONS}
            />
            <div className="flex items-end pb-2">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  id="ls-delayed-tat"
                  type="checkbox"
                  checked={filters.delayedTat}
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, delayedTat: event.target.checked }))
                  }
                  className="size-3.5 accent-primary"
                />
                Show Delayed TAT only
              </label>
            </div>
          </div>
</div>
        </ReportFilterBar>

        <div className="lis-summary-financial" aria-label="Bill financial summary">
          <p>Income <strong>{result ? formatMoney(result.summary.income) : EM_DASH}</strong></p>
          <p>Due <strong>{result ? formatMoney(result.summary.due) : EM_DASH}</strong></p>
          <p>Profit <strong>{EM_DASH}</strong> <span>Expense calculation unavailable</span></p>
          <p className="lis-summary-basis">{result ? `${result.summary.totalBills} matching bills · whole-bill paid amounts and balances, counted once` : "Choose filters and click Show to view the report."}</p>
        </div>

        {(result || loading || error) && <ReportPreview
        reportTitle="Lab Summary"
        criteria={criteriaText}
        total={result?.pagination.total ?? 0}
        unitLabel="tests"
        trailing={summaryLine || undefined}
      >
          {error ? (
            <p className="px-2.5 py-4 text-center text-sm text-red-600">{error}</p>
          ) : (
            <>
              <ReportTable
                columns={columns}
                data={rows}
                rowKey={(row) => row.id}
                rowId={(row) => row.id}
                highlightRow={(row) => find.isMatch(row)}
                loading={loading}
                emptyMessage={REPORT_EMPTY_MESSAGE}
                scrollAreaClassName={TABLE_SCROLL_AREA}
              />
              {result && result.pagination.total > 0 && (
                <ReportToolbar
                  page={result.pagination.page}
                  totalPages={result.pagination.totalPages}
                  total={result.pagination.total}
                  loading={loading}
                  onPageChange={handlePageChange}
                  onRefresh={handleSearch}
                  onExport={handleExport}
                  onPrint={handlePrint}
                  findValue={find.findValue}
                  onFindChange={find.onFindChange}
                  matches={find.matches}
                  onFindNext={find.onFindNext}
                  unitLabel="tests"
                />
              )}
            </>
          )}
        </ReportPreview>}
      </div>

      <ReportPrintSheet
        rows={printRows}
        columns={printColumns}
        title="Lab Summary Report"
        subtitle="Status-wise summary of lab tests"
        criteria={criteriaText}
        generatedAt={new Date().toISOString()}
        summaryNote={printSummaryLine || undefined}
        totals={printTotals}
      />
    </>
  );
}
