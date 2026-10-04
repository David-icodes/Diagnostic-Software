"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileBarChart2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { BillPageHeader } from "@/components/billing/bill-page-header";
import { ReportDateRange } from "@/components/reports/report-date-range";
import { ReportSearchInput } from "@/components/reports/report-search-input";
import { ReportSelect } from "@/components/reports/report-select";
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
import { fetchBillWiseCollection, fetchReportOptions } from "@/services/reports";
import {
  BILL_WISE_ORDER_OPTIONS,
  REPORT_PATIENT_TYPE_OPTIONS,
  PAY_MODE_OPTIONS,
  payModeLabel,
} from "@/types/reports";
import type {
  BillWiseCollectionResponse,
  BillWiseCollectionRow,
} from "@/types/reports";
import { formatDateTime, formatMoney } from "@/lib/utils";

const PRESET_LIMIT = 20;
const PATIENT_TYPE_ORDER = ["gp", "op", "ip", "er"];

interface Filters {
  fromDate: string;
  toDate: string;
  patientId: string;
  orderBy: string;
  withCancelled: boolean;
  billTypes: string[];
  payModes: string[];
  patientTypes: string[];
  collectedBy: string[];
}

const EMPTY_FILTERS: Filters = {
  fromDate: "",
  toDate: "",
  patientId: "",
  orderBy: "date_desc",
  withCancelled: false,
  billTypes: [],
  payModes: [],
  patientTypes: [],
  collectedBy: [],
};

function buildParams(targetPage: number, criteria: Filters) {
  return {
    page: targetPage,
    limit: PRESET_LIMIT,
    fromDate: criteria.fromDate || undefined,
    toDate: criteria.toDate || undefined,
    patientId: criteria.patientId.trim() || undefined,
    orderBy:
      criteria.orderBy === "date_asc" ? ("date_asc" as const) : ("date_desc" as const),
    withCancelled: criteria.withCancelled ? ("1" as const) : undefined,
    billType: criteria.billTypes.length > 0 ? criteria.billTypes.join(",") : undefined,
    payMode: criteria.payModes.length > 0 ? criteria.payModes.join(",") : undefined,
    patientTypes:
      criteria.patientTypes.length > 0 ? criteria.patientTypes.join(",") : undefined,
    collectedBy: criteria.collectedBy.length > 0 ? criteria.collectedBy.join(",") : undefined,
  };
}

export function BillsWiseCollectionContent() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [billTypeOptions, setBillTypeOptions] = useState<{ value: string; label: string }[]>([]);
  const [collectors, setCollectors] = useState<{ value: string; label: string }[]>([]);
  const [result, setResult] = useState<BillWiseCollectionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [printRows, setPrintRows] = useState<BillWiseCollectionRow[]>([]);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    fetchReportOptions()
      .then((options) => {
        setBillTypeOptions(options.billTypes);
        setCollectors(
          options.collectedByUsers
            .map((user) => ({ value: user.id, label: user.name }))
            .sort((a, b) => a.label.localeCompare(b.label)),
        );
      })
      .catch(() => {
        setBillTypeOptions([]);
        setCollectors([]);
      });
    fetchBillWiseCollection(buildParams(1, EMPTY_FILTERS))
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
    fetchBillWiseCollection(buildParams(targetPage, criteria))
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
    setFilters((prev) => ({
      ...EMPTY_FILTERS,
      orderBy: prev.orderBy,
      patientTypes: prev.patientTypes,
    }));
    setApplied((prev) => ({
      ...EMPTY_FILTERS,
      orderBy: prev.orderBy,
      patientTypes: prev.patientTypes,
    }));
    setLoading(true);
    runFetch(1, { ...EMPTY_FILTERS, orderBy: filters.orderBy, patientTypes: filters.patientTypes });
  }, [filters.orderBy, filters.patientTypes, runFetch]);

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

  const find = useReportFind<BillWiseCollectionRow>(rows, (row) => [
    row.billNumber,
    row.patientId,
    row.patientName,
  ]);

  const modeKeys = useMemo(() => PAY_MODE_OPTIONS.map((option) => option.value), []);

  const summaryItems = useMemo(() => {
    if (!result) return [];
    return [
      { label: "Total Records", value: result.summary.totalRecords },
      { label: "Total Paid", value: formatMoney(result.summary.totalPaid) },
      ...PAY_MODE_OPTIONS.filter((option) =>
        modeKeys.includes(option.value),
      ).map((option) => ({
        label: payModeLabel(option.value),
        value: formatMoney(result.summary.modeTotals[option.value] ?? 0),
      })),
    ];
  }, [result, modeKeys]);

  const columns: ReportColumn<BillWiseCollectionRow>[] = useMemo(
    () => [
      {
        key: "billTime",
        header: "Bill Time",
        render: (row) => (
          <span className="font-medium text-slate-800">
            {formatDateTime(row.billTime)}
          </span>
        ),
      },
      {
        key: "billNumber",
        header: "Bill No",
        render: (row) => row.billNumber,
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
        key: "refDoctor",
        header: "Ref Id",
        render: (row) => row.refDoctor,
      },
      {
        key: "paidAmount",
        header: "Paid Amt",
        align: "right",
        render: (row) => (
          <span className="font-semibold text-slate-800">
            {formatMoney(row.paidAmount)}
          </span>
        ),
      },
      ...modeKeys.map(
        (mode): ReportColumn<BillWiseCollectionRow> => ({
          key: `mode_${mode}`,
          header: columnLabel(mode),
          align: "right",
          render: (row) => formatMoney(row.modeBreakdown[mode] ?? 0),
        }),
      ),
      {
        key: "payMode",
        header: "Pay Mode",
        render: (row) => row.payMode,
      },
      {
        key: "collectedBy",
        header: "Collected",
        render: (row) => row.collectedBy,
      },
    ],
    [modeKeys],
  );

  const printColumns: PrintColumn<BillWiseCollectionRow>[] = useMemo(
    () => [
      { key: "billTime", header: "Bill Time", render: (row) => formatDateTime(row.billTime) },
      { key: "billNumber", header: "Bill No", render: (row) => row.billNumber },
      { key: "billFor", header: "Bill For", render: (row) => row.billFor },
      { key: "patient", header: "Patient", render: (row) => `${row.patientName} (${row.patientId})` },
      { key: "refDoctor", header: "Ref Id", render: (row) => row.refDoctor },
      { key: "paidAmount", header: "Paid Amt (Rs.)", render: (row) => formatMoney(row.paidAmount), align: "right" },
      ...modeKeys.map((mode) => ({
        key: `mode_${mode}`,
        header: columnLabel(mode),
        render: (row: BillWiseCollectionRow) => formatMoney(row.modeBreakdown[mode] ?? 0),
        align: "right" as const,
      })),
      { key: "payMode", header: "Pay Mode", render: (row) => row.payMode },
      { key: "collectedBy", header: "Collected", render: (row) => row.collectedBy },
    ],
    [modeKeys],
  );

  const criteriaText = useMemo(
    () =>
      `Apply Date : ${formatCriteriaDate(applied.fromDate) || "—"} To ${
        formatCriteriaDate(applied.toDate) || "—"
      }${
        applied.withCancelled ? "  ·  With Cancelled Bills : Yes" : ""
      }${
        applied.patientTypes.length > 0
          ? `  ·  Patient Types : ${applied.patientTypes
              .sort((a, b) => PATIENT_TYPE_ORDER.indexOf(a) - PATIENT_TYPE_ORDER.indexOf(b))
              .map((value) => {
                const option = REPORT_PATIENT_TYPE_OPTIONS.find(
                  (item) => item.value === value,
                );
                return option?.label ?? value;
              })
              .join(", ")}`
          : ""
      }`,
    [applied],
  );

  const handleExport = useCallback(() => {
    if (!result) return;
    fetchBillWiseCollection({ ...buildParams(1, applied), export: "1" })
      .then((response) => {
        downloadCsv(
          reportCsvName("bills-wise-collection-report"),
          printColumns.map((column) => column.header),
          response.data.map((row) => printColumns.map((column) => column.render(row))),
        );
      })
      .catch(() => setError("Unable to export the report. Please try again."));
  }, [result, applied, printColumns]);

  const handlePrint = useCallback(() => {
    if (!result || printing) return;
    setPrinting(true);
    fetchBillWiseCollection({ ...buildParams(1, applied), export: "1" })
      .then((response) => {
        setPrintRows(response.data);
        window.setTimeout(() => window.print(), 0);
      })
      .catch(() => setError("Unable to print the report. Please try again."))
      .finally(() => setPrinting(false));
  }, [result, applied, printing]);

  return (
    <>
      <div className="mx-auto max-w-7xl space-y-3 p-4 print:hidden sm:p-6">
        <BillPageHeader
          icon={FileBarChart2}
          title="Bills Wise Collection"
          subtitle="Collection details of each bill with payment mode breakdown."
        />

        <ReportFilterBar
          onSearch={handleSearch}
          onClear={handleClear}
          searching={loading}
        >
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
            <div className="space-y-2 lg:col-span-4">
              <ReportDateRange
                fromId="bwc-from-date"
                toId="bwc-to-date"
                fromValue={filters.fromDate}
                toValue={filters.toDate}
                onFromChange={(value) => setFilter("fromDate", value)}
                onToChange={(value) => setFilter("toDate", value)}
              />
              <ReportSearchInput
                id="bwc-patient-id"
                label="Patient ID"
                value={filters.patientId}
                onChange={(value) => setFilter("patientId", value)}
                placeholder="e.g. GP202600001"
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ReportSelect
                  id="bwc-sort-order"
                  label="Sort Order"
                  value={filters.orderBy}
                  onChange={(value) => setFilter("orderBy", value)}
                  options={BILL_WISE_ORDER_OPTIONS}
                  placeholder="Date (Desc)"
                />
                <div className="space-y-1.5">
                  <span className="text-xs font-medium">Patient Type</span>
                  <div className="flex flex-wrap items-center gap-2.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5">
                    {REPORT_PATIENT_TYPE_OPTIONS.map((option) => (
                      <label
                        key={option.value}
                        className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-700"
                      >
                        <input
                          type="checkbox"
                          checked={filters.patientTypes.includes(option.value)}
                          onChange={() =>
                            setFilter(
                              "patientTypes",
                              filters.patientTypes.includes(option.value)
                                ? filters.patientTypes.filter((id) => id !== option.value)
                                : [...filters.patientTypes, option.value],
                            )
                          }
                          className="size-3.5 accent-primary"
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={filters.withCancelled}
                  onChange={(event) => setFilter("withCancelled", event.target.checked)}
                  className="size-3.5 accent-primary"
                />
                With Cancelled Bills
              </label>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:col-span-8">
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
                maxHeightClassName="max-h-48"
              />
              <ReportSelectionPanel
                title="Collected By"
                options={collectors}
                selected={filters.collectedBy}
                onToggle={(value) =>
                  setFilter(
                    "collectedBy",
                    filters.collectedBy.includes(value)
                      ? filters.collectedBy.filter((id) => id !== value)
                      : [...filters.collectedBy, value],
                  )
                }
                onSelectAll={(values) => setFilter("collectedBy", values)}
                onClear={() => setFilter("collectedBy", [])}
                searchPlaceholder="Search collectors…"
                maxHeightClassName="max-h-48"
              />
              <ReportSelectionPanel
                title="Pay Mode"
                options={PAY_MODE_OPTIONS}
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
                maxHeightClassName="max-h-48"
              />
            </div>
          </div>
        </ReportFilterBar>

        <ReportSummary items={summaryItems} />

        <Card>
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
                        <td className="px-2.5 py-2 text-slate-800" colSpan={6}>
                          Total ({result.pagination.total})
                        </td>
                        <td className="px-2.5 py-2 text-right text-slate-800">
                          {formatMoney(result.summary.totalPaid)}
                        </td>
                        {modeKeys.map((mode) => (
                          <td
                            key={mode}
                            className="px-2.5 py-2 text-right text-slate-800"
                          >
                            {formatMoney(result.summary.modeTotals[mode] ?? 0)}
                          </td>
                        ))}
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
                  unitLabel="records"
                />
              )}
            </>
          )}
        </Card>
      </div>

      <ReportPrintSheet
        rows={printRows}
        columns={printColumns}
        title="Bills Wise Collection Report"
        subtitle="Bill-wise collection with payment mode breakdown"
        criteria={criteriaText}
        generatedAt={new Date().toISOString()}
        summaryNote={
          result
            ? `Total Records : ${result.summary.totalRecords}  ·  Total Paid : ${formatMoney(
                result.summary.totalPaid,
              )}  ·  ${PAY_MODE_OPTIONS.map(
                (option) =>
                  `${payModeLabel(option.value)} : ${formatMoney(
                    result.summary.modeTotals[option.value] ?? 0,
                  )}`,
              ).join("  ·  ")}`
            : undefined
        }
        totals={[
          "Total",
          "",
          "",
          "",
          "",
          formatMoney(result?.summary.totalPaid ?? 0),
          ...modeKeys.map((mode) => formatMoney(result?.summary.modeTotals[mode] ?? 0)),
          "",
          "",
        ]}
      />
    </>
  );
}

function columnLabel(mode: string): string {
  return payModeLabel(mode);
}