"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileBarChart2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { BillPageHeader } from "@/components/billing/bill-page-header";
import { ReportDateRange } from "@/components/reports/report-date-range";
import { ReportSelect } from "@/components/reports/report-select";
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
import { fetchClients, fetchDoctors } from "@/services/billing";
import { fetchClientGeneratedLabBills } from "@/services/reports";
import { CLIENT_BILLS_ORDER_OPTIONS } from "@/types/reports";
import type {
  ClientGeneratedLabBillRow,
  ClientGeneratedLabBillsResponse,
  ReportSelectOption,
} from "@/types/reports";
import { formatDate, formatMoney } from "@/lib/utils";

const PRESET_LIMIT = 20;

interface Filters {
  fromDate: string;
  toDate: string;
  clientIds: string[];
  referringDoctorId: string;
  orderBy: string;
}

const EMPTY_FILTERS: Filters = {
  fromDate: "",
  toDate: "",
  clientIds: [],
  referringDoctorId: "",
  orderBy: "",
};

export function ClientGeneratedLabBillsContent() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [clients, setClients] = useState<ReportSelectOption[]>([]);
  const [doctors, setDoctors] = useState<ReportSelectOption[]>([]);
  const [result, setResult] = useState<ClientGeneratedLabBillsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [printRows, setPrintRows] = useState<ClientGeneratedLabBillRow[]>([]);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchClients({ limit: 500 }).then((rows) =>
        rows
          .filter((row) => row.active !== false)
          .map((row) => ({
            value: row.id,
            label: `${row.name}${row.clientCode ? ` (${row.clientCode})` : ""}`,
          }))
          .sort((a, b) => a.label.localeCompare(b.label)),
      ),
      fetchDoctors({ limit: 500 }).then((rows) =>
        rows
          .filter((row) => row.active !== false)
          .map((row) => ({
            value: row.id,
            label: row.name,
          }))
          .sort((a, b) => a.label.localeCompare(b.label)),
      ),
    ])
      .then(([clientRows, doctorRows]) => {
        setClients(clientRows);
        setDoctors(doctorRows);
      })
      .catch(() => {
        setClients([]);
        setDoctors([]);
      });
  }, []);

  const buildParams = useCallback(
    (targetPage: number, criteria: Filters) =>
      ({
        page: targetPage,
        limit: PRESET_LIMIT,
        fromDate: criteria.fromDate || undefined,
        toDate: criteria.toDate || undefined,
        clientIds: criteria.clientIds.length ? criteria.clientIds.join(",") : undefined,
        referringDoctorId: criteria.referringDoctorId || undefined,
        orderBy: (criteria.orderBy || "date_desc") as "date_asc" | "date_desc",
      }) satisfies Parameters<typeof fetchClientGeneratedLabBills>[0],
    [],
  );

  const runExport = useCallback(
    (criteria: Filters) =>
      fetchClientGeneratedLabBills({ ...buildParams(1, criteria), export: "1" }).then(
        (response) => response.data,
      ),
    [buildParams],
  );

  useEffect(() => {
    fetchClientGeneratedLabBills(buildParams(1, EMPTY_FILTERS))
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
      fetchClientGeneratedLabBills(buildParams(targetPage, criteria))
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

  const toggleClient = useCallback((value: string) => {
    setFilters((prev) => {
      const next = prev.clientIds.includes(value)
        ? prev.clientIds.filter((item) => item !== value)
        : [...prev.clientIds, value];
      return { ...prev, clientIds: next };
    });
  }, []);

  const rows = useMemo(() => result?.data ?? [], [result]);

  const find = useReportFind<ClientGeneratedLabBillRow>(rows, (row) => [
    row.billNumber,
    row.clientName,
    row.patientName,
    row.patientId,
    row.refDoctor,
    row.tests,
    row.status,
  ]);

  const summaryItems = useMemo(() => {
    if (!result) return [];
    const total = result.summary;
    return [
      { label: "Total Bills", value: total.totalBills },
      { label: "Total Amount", value: formatMoney(total.totalAmount) },
      { label: "Discount", value: formatMoney(total.totalDiscount) },
      { label: "Net Amount", value: formatMoney(total.totalNet) },
      { label: "Paid Amount", value: formatMoney(total.totalPaid) },
      { label: "Balance Due", value: formatMoney(total.totalDue) },
    ];
  }, [result]);

  const columns: ReportColumn<ClientGeneratedLabBillRow>[] = useMemo(
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
        key: "clientName",
        header: "Client Name",
        render: (row) => <span className="text-slate-800">{row.clientName}</span>,
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
        header: "Ref. Doctor",
        render: (row) => row.refDoctor || "—",
      },
      {
        key: "tests",
        header: "Test",
        render: (row) => <span className="text-xs text-slate-600">{row.tests}</span>,
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
        key: "dueAmount",
        header: "Balance",
        align: "right",
        render: (row) => (
          <span className={row.status === "cancelled" ? "text-muted-foreground" : "text-red-600"}>
            {formatMoney(row.dueAmount)}
          </span>
        ),
      },
      {
        key: "status",
        header: "Status",
        align: "center",
        render: (row) =>
          row.status === "cancelled" ? (
            <Badge variant="outline" className="border-red-200 text-red-600">
              CANCELLED
            </Badge>
          ) : (
            <Badge variant="outline" className="border-emerald-200 text-emerald-600">
              ACTIVE
            </Badge>
          ),
      },
    ],
    [],
  );

  const printColumns: PrintColumn<ClientGeneratedLabBillRow>[] = useMemo(
    () => [
      { key: "billNumber", header: "Bill No", render: (row) => row.billNumber },
      { key: "billDate", header: "Bill Date", render: (row) => formatDate(row.billDate) },
      { key: "clientName", header: "Client Name", render: (row) => row.clientName },
      { key: "patientId", header: "Patient ID", render: (row) => row.patientId },
      { key: "patient", header: "Patient Name", render: (row) => row.patientName },
      { key: "refDoctor", header: "Ref. Doctor", render: (row) => row.refDoctor || "" },
      { key: "tests", header: "Test", render: (row) => row.tests },
      { key: "totalAmount", header: "Total (Rs.)", render: (row) => formatMoney(row.totalAmount), align: "right" },
      { key: "discountAmount", header: "Discount (Rs.)", render: (row) => formatMoney(row.discountAmount), align: "right" },
      { key: "netAmount", header: "Net (Rs.)", render: (row) => formatMoney(row.netAmount), align: "right" },
      { key: "paidAmount", header: "Paid (Rs.)", render: (row) => formatMoney(row.paidAmount), align: "right" },
      { key: "dueAmount", header: "Balance (Rs.)", render: (row) => formatMoney(row.dueAmount), align: "right" },
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
    if (applied.clientIds.length) {
      parts.push(
        `Client : ${applied.clientIds
          .map((id) => clients.find((c) => c.value === id)?.label ?? id)
          .join(", ")}`,
      );
    }
    if (applied.referringDoctorId) {
      parts.push(
        `Ref. Doctor : ${
          doctors.find((d) => d.value === applied.referringDoctorId)?.label ??
          applied.referringDoctorId
        }`,
      );
    }
    parts.push(
      `Sort : ${
        CLIENT_BILLS_ORDER_OPTIONS.find((o) => o.value === applied.orderBy)?.label ??
        "Descending"
      }`,
    );
    return parts.join("  |  ");
  }, [applied, clients, doctors]);

  const handleExport = useCallback(() => {
    if (!result) return;
    runExport(applied)
      .then((rows) => {
        downloadCsv(
          reportCsvName("client-generated-lab-bills-report"),
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
          title="Client Generated Lab Bills"
          subtitle="Vendor / client billed lab bill list with payment details."
        />

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          <div className="lg:col-span-3">
            <ReportFilterBar
              onSearch={handleSearch}
              onClear={handleClear}
              searching={loading}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <ReportDateRange
                  fromId="cb-from-date"
                  toId="cb-to-date"
                  fromValue={filters.fromDate}
                  toValue={filters.toDate}
                  onFromChange={(value) => setFilter("fromDate", value)}
                  onToChange={(value) => setFilter("toDate", value)}
                />
                <ReportSelect
                  id="cb-doctor"
                  label="Ref. Doctor"
                  value={filters.referringDoctorId}
                  onChange={(value) => setFilter("referringDoctorId", value)}
                  options={doctors}
                />
                <ReportSelect
                  id="cb-order-by"
                  label="Date Order"
                  value={filters.orderBy}
                  onChange={(value) => setFilter("orderBy", value)}
                  options={CLIENT_BILLS_ORDER_OPTIONS}
                />
              </div>
            </ReportFilterBar>
          </div>
          <ReportSelectionPanel
            title="Client Name"
            options={clients}
            selected={filters.clientIds}
            onToggle={toggleClient}
            onSelectAll={(values) => setFilters((prev) => ({ ...prev, clientIds: values }))}
            onClear={() => setFilters((prev) => ({ ...prev, clientIds: [] }))}
            searchPlaceholder="Search client…"
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
                  emptyMessage="No client bills found. Adjust the filters and search again."
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
        </Card>
      </div>

      <ReportPrintSheet
        rows={printRows}
        columns={printColumns}
        title="Client Generated Lab Bills"
        subtitle="Vendor / client billed lab bill report"
        criteria={criteriaText}
        generatedAt={new Date().toISOString()}
        summaryNote={
          result
            ? `Total Bills : ${result.summary.totalBills}  ·  Total Amount : ${formatMoney(
                result.summary.totalAmount,
              )}  ·  Discount : ${formatMoney(
                result.summary.totalDiscount,
              )}  ·  Net : ${formatMoney(
                result.summary.totalNet,
              )}  ·  Paid : ${formatMoney(
                result.summary.totalPaid,
              )}  ·  Balance Due : ${formatMoney(result.summary.totalDue)}`
            : undefined
        }
        totals={[
          "Total",
          "",
          "",
          "",
          "",
          "",
          "",
          formatMoney(result?.summary.totalAmount ?? 0),
          formatMoney(result?.summary.totalDiscount ?? 0),
          formatMoney(result?.summary.totalNet ?? 0),
          formatMoney(result?.summary.totalPaid ?? 0),
          formatMoney(result?.summary.totalDue ?? 0),
        ]}
      />
    </>
  );
}