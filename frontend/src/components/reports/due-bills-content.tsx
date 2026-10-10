"use client";

import { ReportPreview } from "@/components/reports/report-preview";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileBarChart2 } from "lucide-react";
import { CardContent } from "@/components/ui/card";
import { BillPageHeader } from "@/components/billing/bill-page-header";
import { ReportDateRange } from "@/components/reports/report-date-range";
import { ReportSearchInput } from "@/components/reports/report-search-input";
import { ReportSelectionPanel } from "@/components/reports/report-selection-panel";
import { ReportFilterBar } from "@/components/reports/report-filter-bar";
import { ReportSummary } from "@/components/reports/report-summary";
import { ReportTable, type ReportColumn } from "@/components/reports/report-table";
import { ReportToolbar } from "@/components/reports/report-toolbar";
import { ReportPrintSheet, type PrintColumn } from "@/components/reports/report-print-sheet";
import { useReportFind } from "@/components/reports/use-report-find";
import {
  formatCriteriaDate,
  downloadReport,
  type ReportExportFormat,
  reportCsvName,
} from "@/components/reports/report-export";
import { fetchDueBills, fetchReportOptions } from "@/services/reports";
import type {
  DueBillReportRow,
  DueBillsResponse,
} from "@/types/reports";
import { formatDate, formatMoney } from "@/lib/utils";

const PRESET_LIMIT = 20;

interface Filters {
  fromDate: string;
  toDate: string;
  patientId: string;
  collectedByIds: string[];
}

const EMPTY_FILTERS: Filters = {
  fromDate: "",
  toDate: "",
  patientId: "",
  collectedByIds: [],
};

function buildParams(targetPage: number, criteria: Filters) {
  return {
    page: targetPage,
    limit: PRESET_LIMIT,
    fromDate: criteria.fromDate || undefined,
    toDate: criteria.toDate || undefined,
    patientId: criteria.patientId.trim() || undefined,
    collectedByIds:
      criteria.collectedByIds.length > 0
        ? criteria.collectedByIds.join(",")
        : undefined,
  };
}

export function DueBillsContent() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [collectors, setCollectors] = useState<{ value: string; label: string }[]>([]);
  const [result, setResult] = useState<DueBillsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [printRows, setPrintRows] = useState<DueBillReportRow[]>([]);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    fetchReportOptions()
      .then((options) =>
        setCollectors(
          options.collectedByUsers.map((user) => ({
            value: user.id,
            label: user.name,
          })).sort((a, b) => a.label.localeCompare(b.label)),
        ),
      )
      .catch(() => setCollectors([]));
    fetchDueBills(buildParams(1, EMPTY_FILTERS))
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
    fetchDueBills(buildParams(targetPage, criteria))
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
    setFilters((prev) => ({ ...EMPTY_FILTERS, collectedByIds: prev.collectedByIds }));
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

  const find = useReportFind<DueBillReportRow>(rows, (row) => [
    row.billNumber,
    row.patientId,
    row.patientName,
  ]);

  const summaryItems = useMemo(() => {
    if (!result) return [];
    return [
      { label: "Total Bills", value: result.summary.totalBills },
      { label: "Total Amount", value: formatMoney(result.summary.totalAmount) },
      { label: "Total Discount", value: formatMoney(result.summary.totalDiscount) },
      { label: "Net Amount", value: formatMoney(result.summary.totalNet) },
      { label: "Paid Amount", value: formatMoney(result.summary.totalPaid) },
      { label: "Balance Due", value: formatMoney(result.summary.totalBalance) },
    ];
  }, [result]);

  const columns: ReportColumn<DueBillReportRow>[] = useMemo(
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
        key: "billFor",
        header: "Bill For",
        render: (row) => row.billFor,
      },
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
        key: "totalAmount",
        header: "Total",
        align: "right",
        render: (row) => formatMoney(row.totalAmount),
      },
      {
        key: "discountAmount",
        header: "Discount",
        align: "right",
        render: (row) => formatMoney(row.discountAmount),
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
        key: "paidAmount",
        header: "Paid",
        align: "right",
        render: (row) => formatMoney(row.paidAmount),
      },
      {
        key: "balance",
        header: "Balance",
        align: "right",
        render: (row) => (
          <span className="font-semibold text-red-600">
            {formatMoney(row.balance)}
          </span>
        ),
      },
      {
        key: "payMode",
        header: "Pay Mode",
        render: (row) => row.payMode,
      },
      {
        key: "collectedBy",
        header: "Collected By",
        render: (row) => row.collectedBy,
      },
    ],
    [],
  );

  const printColumns: PrintColumn<DueBillReportRow>[] = useMemo(
    () => [
      { key: "billNumber", header: "Bill No", render: (row) => row.billNumber },
      { key: "billDate", header: "Bill Date", render: (row) => formatDate(row.billDate) },
      { key: "billFor", header: "Bill For", render: (row) => row.billFor },
      { key: "patient", header: "Patient", render: (row) => `${row.patientName} (${row.patientId})` },
      { key: "totalAmount", header: "Total (Rs.)", render: (row) => formatMoney(row.totalAmount), align: "right" },
      { key: "discountAmount", header: "Discount (Rs.)", render: (row) => formatMoney(row.discountAmount), align: "right" },
      { key: "netAmount", header: "Net (Rs.)", render: (row) => formatMoney(row.netAmount), align: "right" },
      { key: "paidAmount", header: "Paid (Rs.)", render: (row) => formatMoney(row.paidAmount), align: "right" },
      { key: "balance", header: "Balance (Rs.)", render: (row) => formatMoney(row.balance), align: "right" },
      { key: "payMode", header: "Pay Mode", render: (row) => row.payMode },
      { key: "collectedBy", header: "Collected By", render: (row) => row.collectedBy },
    ],
    [],
  );

  const criteriaText = useMemo(
    () =>
      `Apply Date : ${formatCriteriaDate(applied.fromDate) || "—"} To ${
        formatCriteriaDate(applied.toDate) || "—"
      }${
        applied.patientId ? `  ·  Patient ID : ${applied.patientId}` : ""
      }`,
    [applied],
  );

  const handleExport = useCallback((format: ReportExportFormat = "excel") => {
    if (!result) return;
    fetchDueBills({ ...buildParams(1, applied), export: "1" })
      .then(async (response) => {
        await downloadReport(
          reportCsvName("due-bills-report"),
          printColumns.map((column) => column.header),
          response.data.map((row) => printColumns.map((column) => column.render(row))),
          format, criteriaText,
        );
      })
      .catch((error) => { setError(error instanceof Error ? error.message : "Unable to export report"); throw error; });
  }, [criteriaText, result, applied, printColumns]);

  const handlePrint = useCallback(() => {
    if (!result || printing) return;
    setPrinting(true);
    fetchDueBills({ ...buildParams(1, applied), export: "1" })
      .then((response) => {
        setPrintRows(response.data);
        window.setTimeout(() => window.print(), 0);
      })
      .catch(() => setError("Unable to print the report. Please try again."))
      .finally(() => setPrinting(false));
  }, [result, applied, printing]);

  return (
    <>
      <div data-tmis-page="due-bills" className="lis-tmis lis-report-page space-y-3 print:hidden">
        <BillPageHeader
          icon={FileBarChart2}
          title="Dues Report"
          subtitle="List of generated bills with outstanding balance."
        />

        <ReportFilterBar
          onSearch={handleSearch}
          onClear={handleClear}
          searching={loading}
        >
          <div className="lis-due-filter-columns grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ReportDateRange
              fromId="due-from-date"
              toId="due-to-date"
              fromValue={filters.fromDate}
              toValue={filters.toDate}
              onFromChange={(value) => setFilter("fromDate", value)}
              onToChange={(value) => setFilter("toDate", value)}
            />
            <ReportSearchInput
              id="due-patient-id"
              label="Patient ID"
              value={filters.patientId}
              onChange={(value) => setFilter("patientId", value)}

            />
            <div className="grid grid-cols-1 gap-3 sm:col-span-2 lg:col-span-2">
              <ReportSelectionPanel
                title="Collected By"
                options={collectors}
                selected={filters.collectedByIds}
                onToggle={(value) =>
                  setFilter(
                    "collectedByIds",
                    filters.collectedByIds.includes(value)
                      ? filters.collectedByIds.filter((id) => id !== value)
                      : [...filters.collectedByIds, value],
                  )
                }
                onSelectAll={(values) => setFilter("collectedByIds", values)}
                onClear={() => setFilter("collectedByIds", [])}
                searchPlaceholder="Search collectors…"
                maxHeightClassName="max-h-48"
              />
            </div>
          </div>
        </ReportFilterBar>

        <ReportSummary items={summaryItems} />

        <ReportPreview reportTitle="Due Bills Report" criteria={criteriaText} total={result?.pagination.total ?? 0} className="lis-tmis-document">
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
                        <td className="px-2.5 py-2 text-slate-800" colSpan={4}>
                          Total ({result.pagination.total})
                        </td>
                        <td className="px-2.5 py-2 text-right text-slate-800">
                          {formatMoney(result.summary.totalAmount)}
                        </td>
                        <td className="px-2.5 py-2 text-right text-slate-800">
                          {formatMoney(result.summary.totalDiscount)}
                        </td>
                        <td className="px-2.5 py-2 text-right text-slate-800">
                          {formatMoney(result.summary.totalNet)}
                        </td>
                        <td className="px-2.5 py-2 text-right text-slate-800">
                          {formatMoney(result.summary.totalPaid)}
                        </td>
                        <td className="px-2.5 py-2 text-right text-red-600">
                          {formatMoney(result.summary.totalBalance)}
                        </td>
                        <td className="px-2.5 py-2" colSpan={2} />
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
        title="Due Bills Report"
        subtitle="Generated bills with outstanding balance"
        criteria={criteriaText}
        generatedAt={new Date().toISOString()}
        summaryNote={
          result
            ? `Total Bills : ${result.summary.totalBills}  ·  Net Amount : ${formatMoney(
                result.summary.totalNet,
              )}  ·  Total Paid : ${formatMoney(
                result.summary.totalPaid,
              )}  ·  Balance Due : ${formatMoney(result.summary.totalBalance)}`
            : undefined
        }
        totals={[
          "Total",
          "",
          "",
          "",
          formatMoney(result?.summary.totalAmount ?? 0),
          formatMoney(result?.summary.totalDiscount ?? 0),
          formatMoney(result?.summary.totalNet ?? 0),
          formatMoney(result?.summary.totalPaid ?? 0),
          formatMoney(result?.summary.totalBalance ?? 0),
          "",
          "",
        ]}
      />
    </>
  );
}
