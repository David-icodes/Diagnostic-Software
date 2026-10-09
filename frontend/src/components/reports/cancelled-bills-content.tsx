"use client";

import { ReportPreview } from "@/components/reports/report-preview";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileBarChart2 } from "lucide-react";
import { CardContent } from "@/components/ui/card";
import { BillPageHeader } from "@/components/billing/bill-page-header";
import { ReportDateRange } from "@/components/reports/report-date-range";
import { ReportSelectionPanel } from "@/components/reports/report-selection-panel";
import { ReportFilterBar } from "@/components/reports/report-filter-bar";
import { ReportSummary } from "@/components/reports/report-summary";
import { ReportTable, type ReportColumn } from "@/components/reports/report-table";
import { ReportToolbar } from "@/components/reports/report-toolbar";
import { ReportPrintSheet, type PrintColumn } from "@/components/reports/report-print-sheet";
import { useReportFind } from "@/components/reports/use-report-find";
import {
  formatCriteriaDate,
  downloadCsv,
  reportCsvName,
} from "@/components/reports/report-export";
import { fetchCancelledBills, fetchReportOptions } from "@/services/reports";
import type {
  CancelledBillReportRow,
  CancelledBillsMode,
  CancelledBillsResponse,
} from "@/types/reports";
import { formatDate, formatMoney } from "@/lib/utils";

const PRESET_LIMIT = 20;

interface Filters {
  fromDate: string;
  toDate: string;
  mode: CancelledBillsMode;
  billTypes: string[];
  payModes: string[];
  cancelledBy: string[];
}

const EMPTY_FILTERS: Filters = {
  fromDate: "",
  toDate: "",
  mode: "summary",
  billTypes: [],
  payModes: [],
  cancelledBy: [],
};

function buildParams(targetPage: number, criteria: Filters) {
  return {
    page: targetPage,
    limit: PRESET_LIMIT,
    mode: criteria.mode,
    fromDate: criteria.fromDate || undefined,
    toDate: criteria.toDate || undefined,
    billType: criteria.billTypes.length > 0 ? criteria.billTypes.join(",") : undefined,
    payMode: criteria.payModes.length > 0 ? criteria.payModes.join(",") : undefined,
    cancelledBy:
      criteria.cancelledBy.length > 0 ? criteria.cancelledBy.join(",") : undefined,
  };
}

export function CancelledBillsContent() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [billTypeOptions, setBillTypeOptions] = useState<{ value: string; label: string }[]>([]);
  const [payModeOptions, setPayModeOptions] = useState<{ value: string; label: string }[]>([]);
  const [cancellers, setCancellers] = useState<{ value: string; label: string }[]>([]);
  const [result, setResult] = useState<CancelledBillsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [printRows, setPrintRows] = useState<CancelledBillReportRow[]>([]);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    fetchReportOptions()
      .then((options) => {
        setBillTypeOptions(options.billTypes);
        setPayModeOptions(options.payModes);
        setCancellers(
          options.collectedByUsers
            .map((user) => ({ value: user.id, label: user.name }))
            .sort((a, b) => a.label.localeCompare(b.label)),
        );
      })
      .catch(() => {
        setBillTypeOptions([]);
        setPayModeOptions([]);
        setCancellers([]);
      });
    fetchCancelledBills(buildParams(1, EMPTY_FILTERS))
      .then((response) => {
        setResult(response);
        setError(null);
      })
      .catch(() => {
        setResult(null);
        setError("Unable to load the report. Please try again.");
      })
      .finally(() => setLoading(false));
  }, []);

  const runFetch = useCallback((targetPage: number, criteria: Filters) => {
    fetchCancelledBills(buildParams(targetPage, criteria))
      .then((response) => {
        setResult(response);
        setError(null);
      })
      .catch(() => {
        setResult(null);
        setError("Unable to load the report. Please try again.");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSearch = useCallback(() => {
    setApplied(filters);
    setLoading(true);
    runFetch(1, filters);
  }, [filters, runFetch]);

  const handleClear = useCallback(() => {
    setFilters((prev) => ({ ...EMPTY_FILTERS, mode: prev.mode }));
    setApplied(EMPTY_FILTERS);
    setLoading(true);
    runFetch(1, EMPTY_FILTERS);
  }, [runFetch]);

  const handlePageChange = useCallback(
    (targetPage: number) => {
      setLoading(true);
      runFetch(targetPage, applied);
    },
    [applied, runFetch],
  );

  const setFilter = useCallback(<K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const rows = useMemo(() => result?.data ?? [], [result]);

  const find = useReportFind<CancelledBillReportRow>(rows, (row) => [
    row.billNumber,
    row.patientId,
    row.patientName,
  ]);

  const summaryItems = useMemo(() => {
    if (!result) return [];
    return [
      { label: "Total Bills", value: result.summary.totalBills },
      { label: "Net Amount", value: formatMoney(result.summary.totalNet) },
    ];
  }, [result]);

  const columns: ReportColumn<CancelledBillReportRow>[] = useMemo(
    () => [
      {
        key: "billNumber",
        header: "Bill No",
        render: (row) => (
          <span className="font-medium text-slate-800">{row.billNumber}</span>
        ),
      },
      {
        key: "billDate",
        header: "Bill Date",
        render: (row) => formatDate(row.billDate),
      },
      {
        key: "cancelledAt",
        header: "Cancelled Date",
        render: (row) => formatDate(row.cancelledAt),
      },
      {
        key: "billFor",
        header: "Bill For",
        render: (row) => row.billFor,
      },
      ...(applied.mode === "detailed"
        ? [
            {
              key: "billType",
              header: "Bill Type",
              render: (row: CancelledBillReportRow) => row.billType,
            },
          ]
        : []),
      {
        key: "patient",
        header: "Patient",
        render: (row) => (
          <div className="flex flex-col">
            <span className="font-medium text-slate-800">{row.patientName}</span>
            <span className="text-xs text-muted-foreground">{row.patientId}</span>
          </div>
        ),
      },
      {
        key: "tests",
        header: "Tests",
        render: (row) =>
          applied.mode === "detailed" ? row.tests.join(", ") : "—",
      },
      {
        key: "netAmount",
        header: "Net",
        align: "right",
        render: (row) => (
          <span className="font-semibold text-slate-800">
            {formatMoney(row.netAmount)}
          </span>
        ),
      },
      {
        key: "payMode",
        header: "Pay Mode",
        render: (row) => row.payMode,
      },
      {
        key: "cancelledBy",
        header: "Cancelled By",
        render: (row) => row.cancelledBy,
      },
      {
        key: "remarks",
        header: "Remarks",
        render: (row) => (
          <span className="text-xs text-muted-foreground">{row.remarks || "—"}</span>
        ),
      },
    ],
    [applied.mode],
  );

  const printColumns: PrintColumn<CancelledBillReportRow>[] = useMemo(
    () => [
      { key: "billNumber", header: "Bill No", render: (row) => row.billNumber },
      { key: "billDate", header: "Bill Date", render: (row) => formatDate(row.billDate) },
      { key: "cancelledAt", header: "Cancelled Date", render: (row) => formatDate(row.cancelledAt) },
      { key: "billFor", header: "Bill For", render: (row) => row.billFor },
      { key: "patient", header: "Patient", render: (row) => `${row.patientName} (${row.patientId})` },
      ...(applied.mode === "detailed"
        ? [
            {
              key: "tests",
              header: "Tests",
              render: (row: CancelledBillReportRow) => row.tests.join(", "),
            },
          ]
        : []),
      { key: "netAmount", header: "Net (Rs.)", render: (row) => formatMoney(row.netAmount), align: "right" },
      { key: "payMode", header: "Pay Mode", render: (row) => row.payMode },
      { key: "cancelledBy", header: "Cancelled By", render: (row) => row.cancelledBy },
      { key: "remarks", header: "Remarks", render: (row) => row.remarks || "" },
    ],
    [applied.mode],
  );

  const criteriaText = useMemo(
    () =>
      `Apply Date : ${formatCriteriaDate(applied.fromDate) || "—"} To ${
        formatCriteriaDate(applied.toDate) || "—"
      }  ·  Mode : ${applied.mode === "detailed" ? "Detailed" : "Summary"}`,
    [applied],
  );

  const handleExport = useCallback(() => {
    if (!result) return;
    fetchCancelledBills({ ...buildParams(1, applied), export: "1" })
      .then((response) => {
        downloadCsv(
          reportCsvName("cancelled-bills-report"),
          printColumns.map((column) => column.header),
          response.data.map((row) => printColumns.map((column) => column.render(row))),
        );
      })
      .catch(() => setError("Unable to export the report. Please try again."));
  }, [result, applied, printColumns]);

  const handlePrint = useCallback(() => {
    if (!result || printing) return;
    setPrinting(true);
    fetchCancelledBills({ ...buildParams(1, applied), export: "1" })
      .then((response) => {
        setPrintRows(response.data);
        window.setTimeout(() => window.print(), 0);
      })
      .catch(() => setError("Unable to print the report. Please try again."))
      .finally(() => setPrinting(false));
  }, [result, applied, printing]);

  return (
    <>
      <div data-tmis-page="cancelled-bills" className="lis-tmis lis-report-page space-y-3 print:hidden">
        <BillPageHeader
          icon={FileBarChart2}
          title="Cancelled Bills Report"
          subtitle="List of cancelled bills with cancellation remarks."
        />

        <ReportFilterBar
          onSearch={handleSearch}
          onClear={handleClear}
          searching={loading}
        >
          <div className="lis-cancelled-layout grid grid-cols-1 gap-3 lg:grid-cols-12">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:col-span-8">
              <ReportSelectionPanel
                title="Bill Type"
                options={billTypeOptions}
                selected={filters.billTypes}
                onToggle={(value) =>
                  setFilter(
                    "billTypes",
                    filters.billTypes.includes(value)
                      ? filters.billTypes.filter((id) => id !== value)
                      : [...filters.billTypes, value],
                  )
                }
                onSelectAll={(values) => setFilter("billTypes", values)}
                onClear={() => setFilter("billTypes", [])}
                searchPlaceholder="Search bill types…"
                maxHeightClassName="max-h-40"
              />
              <ReportSelectionPanel
                title="Pay Mode"
                options={payModeOptions}
                selected={filters.payModes}
                onToggle={(value) =>
                  setFilter(
                    "payModes",
                    filters.payModes.includes(value)
                      ? filters.payModes.filter((id) => id !== value)
                      : [...filters.payModes, value],
                  )
                }
                onSelectAll={(values) => setFilter("payModes", values)}
                onClear={() => setFilter("payModes", [])}
                searchPlaceholder="Search pay modes…"
                maxHeightClassName="max-h-40"
              />
              <ReportSelectionPanel
                title="Cancelled By"
                options={cancellers}
                selected={filters.cancelledBy}
                onToggle={(value) =>
                  setFilter(
                    "cancelledBy",
                    filters.cancelledBy.includes(value)
                      ? filters.cancelledBy.filter((id) => id !== value)
                      : [...filters.cancelledBy, value],
                  )
                }
                onSelectAll={(values) => setFilter("cancelledBy", values)}
                onClear={() => setFilter("cancelledBy", [])}
                searchPlaceholder="Search users…"
                maxHeightClassName="max-h-40"
              />
            </div>
<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:col-span-4">
              <ReportDateRange
                fromId="cancelled-from-date"
                toId="cancelled-to-date"
                fromValue={filters.fromDate}
                toValue={filters.toDate}
                onFromChange={(value) => setFilter("fromDate", value)}
                onToChange={(value) => setFilter("toDate", value)}
              />
              <div className="space-y-1.5">
                <span className="text-xs font-medium">Report Type</span>
                <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-2.5 py-1.5">
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700">
                    <input
                      type="radio"
                      name="cancelled-mode"
                      checked={filters.mode === "summary"}
                      onChange={() => {
                        setFilter("mode", "summary");
                      }}
                      className="size-3.5 accent-primary"
                    />
                    Summary
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700">
                    <input
                      type="radio"
                      name="cancelled-mode"
                      checked={filters.mode === "detailed"}
                      onChange={() => {
                        setFilter("mode", "detailed");
                      }}
                      className="size-3.5 accent-primary"
                    />
                    Detailed
                  </label>
                </div>
              </div>
            </div>
          </div>
        </ReportFilterBar>

        <ReportSummary items={summaryItems} />

        <ReportPreview reportTitle="Cancelled Bills Report" criteria={criteriaText} total={result?.pagination.total ?? 0} className="lis-tmis-document">
          {error ? (
            <CardContent className="px-2.5 py-5 text-center text-sm text-red-600">
              {error}
            </CardContent>
          ) : (
            <>
              <CardContent className="p-0">
                <ReportTable
                  columns={columns}
                  data={rows}
                  rowKey={(row) => row.id}
                  rowId={(row) => row.id}
                  highlightRow={(row) => find.isMatch(row)}
                  loading={loading}
                  emptyMessage="Records are not available"
                  footer={
                    result && result.pagination.total > 0 ? (
                      <tr className="border-t border-slate-200 bg-slate-100 font-semibold">
                        <td className="px-2.5 py-2 text-slate-800" colSpan={5}>
                          Total ({result.pagination.total})
                        </td>
                        <td className="px-2.5 py-2 text-right text-slate-800">
                          {formatMoney(result.summary.totalNet)}
                        </td>
                        <td className="px-2.5 py-2" colSpan={4} />
                      </tr>
                    ) : undefined
                  }
                />
              </CardContent>
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
                  unitLabel="bills"
                />
              )}
            </>
          )}
        </ReportPreview>
      </div>

      <ReportPrintSheet
        rows={printRows}
        columns={printColumns}
        title="Cancelled Bills Report"
        subtitle={`${applied.mode === "detailed" ? "Detailed" : "Summary"} list of cancelled bills`}
        criteria={criteriaText}
        generatedAt={new Date().toISOString()}
        summaryNote={
          result
            ? `Total Bills : ${result.summary.totalBills}  ·  Net Amount : ${formatMoney(
                result.summary.totalNet,
              )}`
            : undefined
        }
        totals={[
          "Total",
          "",
          "",
          "",
          formatMoney(result?.summary.totalNet ?? 0),
          "",
          "",
          "",
          "",
        ]}
      />
    </>
  );
}