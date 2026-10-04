"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileBarChart2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { BillPageHeader } from "@/components/billing/bill-page-header";
import { ReportDateRange } from "@/components/reports/report-date-range";
import { ReportFilterBar } from "@/components/reports/report-filter-bar";
import { ReportSummary } from "@/components/reports/report-summary";
import { ReportTable, type ReportColumn } from "@/components/reports/report-table";
import { ReportToolbar } from "@/components/reports/report-toolbar";
import { ReportSelectionPanel } from "@/components/reports/report-selection-panel";
import { ReportPrintSheet, type PrintColumn } from "@/components/reports/report-print-sheet";
import { useReportFind } from "@/components/reports/use-report-find";
import {
  formatCriteriaDate,
  downloadCsv,
  reportCsvName,
} from "@/components/reports/report-export";
import { fetchOutsideLabs, fetchOutsideSentLabTests } from "@/services/reports";
import type {
  OutsideLabOption,
  OutsideSentLabTestResponse,
  OutsideSentLabTestRow,
} from "@/types/reports";
import { formatDate, formatDateTime, formatMoney } from "@/lib/utils";

const PRESET_LIMIT = 20;

interface Filters {
  fromDate: string;
  toDate: string;
  outsideLabIds: string[];
}

const EMPTY_FILTERS: Filters = { fromDate: "", toDate: "", outsideLabIds: [] };

export function OutsideSentLabTestContent() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [labs, setLabs] = useState<OutsideLabOption[]>([]);
  const [result, setResult] = useState<OutsideSentLabTestResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [printRows, setPrintRows] = useState<OutsideSentLabTestRow[]>([]);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    fetchOutsideLabs()
      .then((rows) => setLabs(rows))
      .catch(() => setLabs([]));
  }, []);

  const labOptions = useMemo(
    () =>
      labs.map((lab) => ({
        value: lab.id,
        label: lab.city ? `${lab.name} (${lab.city})` : lab.name,
      })),
    [labs],
  );

  const buildParams = useCallback(
    (targetPage: number, criteria: Filters) =>
      ({
        page: targetPage,
        limit: PRESET_LIMIT,
        fromDate: criteria.fromDate || undefined,
        toDate: criteria.toDate || undefined,
        outsideLabIds: criteria.outsideLabIds.length
          ? criteria.outsideLabIds.join(",")
          : undefined,
      }) satisfies Parameters<typeof fetchOutsideSentLabTests>[0],
    [],
  );

  const runExport = useCallback(
    (criteria: Filters) =>
      fetchOutsideSentLabTests({ ...buildParams(1, criteria), export: "1" }).then(
        (response) => response.data,
      ),
    [buildParams],
  );

  useEffect(() => {
    fetchOutsideSentLabTests(buildParams(1, EMPTY_FILTERS))
      .then((response) => {
        setResult(response);
        setError(null);
      })
      .catch(() => {
        setResult(null);
        setError("Unable to load the report. Please try again.");
      })
      .finally(() => setLoading(false));
  }, [buildParams]);

  const runFetch = useCallback(
    (targetPage: number, criteria: Filters) => {
      fetchOutsideSentLabTests(buildParams(targetPage, criteria))
        .then((response) => {
          setResult(response);
          setError(null);
        })
        .catch(() => {
          setResult(null);
          setError("Unable to load the report. Please try again.");
        })
        .finally(() => setLoading(false));
    },
    [buildParams],
  );

  const handleSearch = useCallback(() => {
    setApplied(filters);
    setLoading(true);
    runFetch(1, filters);
  }, [filters, runFetch]);

  const handleClear = useCallback(() => {
    setFilters(EMPTY_FILTERS);
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

  const setFilter = useCallback((key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleLab = useCallback((value: string) => {
    setFilters((prev) => {
      const next = prev.outsideLabIds.includes(value)
        ? prev.outsideLabIds.filter((item) => item !== value)
        : [...prev.outsideLabIds, value];
      return { ...prev, outsideLabIds: next };
    });
  }, []);

  const rows = useMemo(() => result?.data ?? [], [result]);

  const find = useReportFind<OutsideSentLabTestRow>(rows, (row) => [
    formatDate(row.sentDate),
    row.labCenterName,
    row.patientName,
    row.patientId,
    row.testName,
  ]);

  const summaryItems = useMemo(() => {
    if (!result) return [];
    return [
      { label: "Total Records", value: result.summary.totalRecords },
      { label: "Total Amount", value: formatMoney(result.summary.totalAmount) },
    ];
  }, [result]);

  const noteLines = useMemo(() => {
    const lines = [
      "Only samples marked as sent to an outside lab centre within the selected date range are shown.",
      '"Total Amount" reflects the amount charged on the originating bill for the sample; no separate outside-centre charge is recorded.',
    ];
    if (applied.outsideLabIds.length === 0) {
      lines.push("No lab centre selected - all outside-sent tests are included.");
    }
    return lines;
  }, [applied.outsideLabIds.length]);

  const columns: ReportColumn<OutsideSentLabTestRow>[] = useMemo(
    () => [
      {
        key: "sentDate",
        header: "Sent Date",
        render: (row) => (
          <span className="whitespace-nowrap text-slate-700">
            {formatDateTime(row.sentDate)}
          </span>
        ),
      },
      {
        key: "labCenter",
        header: "Lab Center",
        render: (row) => (
          <span className="font-medium text-slate-800">{row.labCenterName}</span>
        ),
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
        key: "test",
        header: "Test",
        render: (row) => row.testName,
      },
      {
        key: "amount",
        header: "Total Amount",
        align: "right",
        render: (row) => (
          <span className="font-semibold text-slate-800">
            {formatMoney(row.totalAmount)}
          </span>
        ),
      },
    ],
    [],
  );

  const printColumns: PrintColumn<OutsideSentLabTestRow>[] = useMemo(
    () => [
      {
        key: "sentDate",
        header: "Sent Date",
        render: (row) => formatDateTime(row.sentDate),
      },
      { key: "labCenter", header: "Lab Center", render: (row) => row.labCenterName },
      { key: "patientId", header: "Patient ID", render: (row) => row.patientId },
      { key: "patient", header: "Patient Name", render: (row) => row.patientName },
      { key: "test", header: "Test", render: (row) => row.testName },
      {
        key: "amount",
        header: "Total Amount (Rs.)",
        render: (row) => formatMoney(row.totalAmount),
        align: "right",
      },
    ],
    [],
  );

  const criteriaText = useMemo(() => {
    const parts = [];
    parts.push(
      `Apply Date : ${formatCriteriaDate(applied.fromDate) || "—"} To ${
        formatCriteriaDate(applied.toDate) || "—"
      }`,
    );
    if (applied.outsideLabIds.length) {
      parts.push(
        `Lab Center : ${applied.outsideLabIds
          .map((id) => labs.find((lab) => lab.id === id)?.name ?? id)
          .join(", ")}`,
      );
    }
    return parts.join("  |  ");
  }, [applied, labs]);

  const handleExport = useCallback(() => {
    if (!result) return;
    runExport(applied)
      .then((rows) => {
        downloadCsv(
          reportCsvName("outside-sent-lab-tests-report"),
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
      <div className="mx-auto max-w-7xl space-y-3 p-4 print:hidden sm:p-6">
        <BillPageHeader
          icon={FileBarChart2}
          title="Outside Sent LabTest Details"
          subtitle="Tests sent to outside lab centres within the selected date range."
        />

        <div className="space-y-0.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
          {noteLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          <div className="lg:col-span-3">
            <ReportFilterBar
              onSearch={handleSearch}
              onClear={handleClear}
              searching={loading}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <ReportDateRange
                  fromId="os-from-date"
                  toId="os-to-date"
                  fromValue={filters.fromDate}
                  toValue={filters.toDate}
                  onFromChange={(value) => setFilter("fromDate", value)}
                  onToChange={(value) => setFilter("toDate", value)}
                />
              </div>
            </ReportFilterBar>
          </div>
          <ReportSelectionPanel
            title="Lab Center"
            options={labOptions}
            selected={filters.outsideLabIds}
            onToggle={toggleLab}
            onSelectAll={(values) =>
              setFilters((prev) => ({ ...prev, outsideLabIds: values }))
            }
            onClear={() => setFilters((prev) => ({ ...prev, outsideLabIds: [] }))}
            searchPlaceholder="Search lab center…"
            maxHeightClassName="max-h-64"
          />
        </div>

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
                  emptyMessage="No outside-sent tests found. Adjust the filters and search again."
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
                  unitLabel="tests"
                />
              )}
            </>
          )}
        </Card>
      </div>

      <ReportPrintSheet
        rows={printRows}
        columns={printColumns}
        title="Outside Sent LabTest Details"
        subtitle="Tests sent to outside lab centres"
        criteria={criteriaText}
        generatedAt={new Date().toISOString()}
        summaryNote={
          result
            ? `Total Records : ${result.summary.totalRecords}  ·  Total Amount : ${formatMoney(
                result.summary.totalAmount,
              )}`
            : undefined
        }
        totals={[
          "Total",
          "",
          "",
          "",
          "",
          formatMoney(result?.summary.totalAmount ?? 0),
        ]}
      />
    </>
  );
}