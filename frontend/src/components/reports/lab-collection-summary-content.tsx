"use client";

import { localToday } from "@/lib/report-filter-state";
import { ReportPreview } from "@/components/reports/report-preview";

import { useCallback, useMemo, useRef, useState } from "react";
import { FileBarChart2 } from "lucide-react";
import { CardContent } from "@/components/ui/card";
import { BillPageHeader } from "@/components/billing/bill-page-header";
import { ReportDateRange } from "@/components/reports/report-date-range";
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
import { fetchLabCollectionSummary } from "@/services/reports";
import type {
  LabCollectionSummaryResponse,
  LabCollectionSummaryRow,
} from "@/types/reports";
import { formatDate, formatMoney } from "@/lib/utils";

const PRESET_LIMIT = 20;

interface Filters {
  fromDate: string;
  toDate: string;
}

const EMPTY_FILTERS: Filters = { fromDate: "", toDate: "" };

export function LabCollectionSummaryContent() {
  const [filters, setFilters] = useState<Filters>(() => ({ ...EMPTY_FILTERS, fromDate: localToday(), toDate: localToday() }));
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [result, setResult] = useState<LabCollectionSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const requestSequence = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [printRows, setPrintRows] = useState<LabCollectionSummaryRow[]>([]);
  const [printing, setPrinting] = useState(false);

  const buildParams = useCallback(
    (targetPage: number, criteria: Filters) =>
      ({
        page: targetPage,
        limit: PRESET_LIMIT,
        fromDate: criteria.fromDate || undefined,
        toDate: criteria.toDate || undefined,
      }) satisfies Parameters<typeof fetchLabCollectionSummary>[0],
    [],
  );

  const runExport = useCallback(
    (criteria: Filters) =>
      fetchLabCollectionSummary({ ...buildParams(1, criteria), export: "1" }).then(
        (response) => response.data,
      ),
    [buildParams],
  );

  const runFetch = useCallback(
    (targetPage: number, criteria: Filters) => {
      const sequence = ++requestSequence.current;
      fetchLabCollectionSummary(buildParams(targetPage, criteria))
        .then((response) => {
          if (sequence !== requestSequence.current) return;
          setResult(response);
          setError(null);
        })
        .catch(() => {
          if (sequence !== requestSequence.current) return;
          setResult(null);
          setError("Unable to load the report. Please try again.");
        })
        .finally(() => { if (sequence === requestSequence.current) setLoading(false); });
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
    setApplied(EMPTY_FILTERS); setResult(null); setPrintRows([]); setError(null); setLoading(false);
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

  const rows = useMemo(() => result?.data ?? [], [result]);

  const find = useReportFind<LabCollectionSummaryRow>(rows, (row) => [
    formatDate(row.reportDate),
  ]);

  const expenseUnavailable = result?.meta?.expensesUnavailable !== false;

  const summaryItems = useMemo(() => {
    if (!result) return [];
    return [
      { label: "Total Lab Amount", value: formatMoney(result.summary.totalLabAmount) },
      { label: "Total Expenses", value: expenseUnavailable ? "Unavailable" : formatMoney(result.summary.totalExpenses) },
      { label: "Profit", value: expenseUnavailable ? "Unavailable" : formatMoney(result.summary.profit) },
      { label: "Profit %", value: expenseUnavailable ? "Unavailable" : `${result.summary.profitPercent}%` },
    ];
  }, [result, expenseUnavailable]);

  const expenseNote = useMemo(() => {
    if (!result?.meta?.expensesUnavailable) return null;
    return "Expenses and profit unavailable";
  }, [result]);

  const columns: ReportColumn<LabCollectionSummaryRow>[] = useMemo(
    () => [
      {
        key: "reportDate",
        header: "Date",
        render: (row) => (
          <span className="font-medium text-slate-800">
            {formatDate(row.reportDate)}
          </span>
        ),
      },
      {
        key: "labAmount",
        header: "Lab Amount",
        align: "right",
        render: (row) => formatMoney(row.labAmount),
      },
      {
        key: "expenses",
        header: "Expenses",
        align: "right",
        render: (row) => expenseUnavailable ? "Unavailable" : formatMoney(row.expenses),
      },
    ],
    [expenseUnavailable],
  );

  const printColumns: PrintColumn<LabCollectionSummaryRow>[] = useMemo(
    () => [
      { key: "reportDate", header: "Date", render: (row) => formatDate(row.reportDate) },
      {
        key: "labAmount",
        header: "Lab Amount (Rs.)",
        render: (row) => formatMoney(row.labAmount),
        align: "right",
      },
      {
        key: "expenses",
        header: "Expenses (Rs.)",
        render: (row) => expenseUnavailable ? "Unavailable" : formatMoney(row.expenses),
        align: "right",
      },
    ],
    [expenseUnavailable],
  );

  const criteriaText = useMemo(
    () =>
      `Apply Date : ${formatCriteriaDate(applied.fromDate) || "—"} To ${
        formatCriteriaDate(applied.toDate) || "—"
      }`,
    [applied],
  );

  const handleExport = useCallback(() => {
    if (!result) return;
    runExport(applied)
      .then((rows) => {
        downloadCsv(
          reportCsvName("lab-collection-summary-report"),
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

  return (
    <>
      <div data-tmis-page="lab-collection-summary" className="lis-tmis lis-report-page space-y-3 print:hidden">
        <BillPageHeader
          icon={FileBarChart2}
          title="Lab Income And Expense"
          subtitle="Date-wise lab income collection summary."
        />

        {expenseNote && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">
            {expenseNote}
          </div>
        )}

        <ReportFilterBar
          onSearch={handleSearch}
          onClear={handleClear}
          searching={loading}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ReportDateRange
              fromId="lc-from-date"
              toId="lc-to-date"
              fromValue={filters.fromDate}
              toValue={filters.toDate}
              onFromChange={(value) => setFilter("fromDate", value)}
              onToChange={(value) => setFilter("toDate", value)}
            />
          </div>
        </ReportFilterBar>

        <ReportSummary items={summaryItems} />

        {(result || loading || error) && <ReportPreview reportTitle="Lab Income And Expense" criteria={criteriaText} total={result?.pagination.total ?? 0} className="lis-tmis-document">
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
                  emptyMessage="No collection records found. Adjust the date range and search again."
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
                  unitLabel="days"
                />
              )}
            </>
          )}
        </ReportPreview>}
      </div>

      <ReportPrintSheet
        rows={printRows}
        columns={printColumns}
        title="Lab Income And Expense"
        subtitle="Lab Collection Summary Report"
        criteria={criteriaText}
        generatedAt={new Date().toISOString()}
        summaryNote={
          result
            ? `Total Lab Amount : ${formatMoney(result.summary.totalLabAmount)} | Expenses : ${expenseUnavailable ? "Unavailable" : formatMoney(result.summary.totalExpenses)} | Profit : ${expenseUnavailable ? "Unavailable" : formatMoney(result.summary.profit)} | Profit % : ${expenseUnavailable ? "Unavailable" : `${result.summary.profitPercent}%`}`
            : undefined
        }
        totals={[
          "Total",
          formatMoney(result?.summary.totalLabAmount ?? 0),
          expenseUnavailable ? "Unavailable" : formatMoney(result?.summary.totalExpenses ?? 0),
        ]}
      />
    </>
  );
}