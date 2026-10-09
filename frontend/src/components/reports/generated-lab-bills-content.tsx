"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { localToday } from "@/lib/report-filter-state";
import { Badge } from "@/components/ui/badge";
import { ReportDateRange } from "@/components/reports/report-date-range";
import { ReportSearchInput } from "@/components/reports/report-search-input";
import { ReportSelect } from "@/components/reports/report-select";
import { ReportFilterBar } from "@/components/reports/report-filter-bar";
import { ReportSelectionPanel } from "@/components/reports/report-selection-panel";
import {
  REPORT_EMPTY_MESSAGE,
  ReportTable,
  type ReportColumn,
} from "@/components/reports/report-table";
import { ReportTitleBar } from "@/components/reports/report-title-bar";
import { ReportPreview } from "@/components/reports/report-preview";
import { ReportToolbar } from "@/components/reports/report-toolbar";
import { useReportFind } from "@/components/reports/use-report-find";
import { formatCriteriaDate, downloadReport, reportCsvName, type ReportExportFormat } from "@/components/reports/report-export";
import {
  fetchDepartments,
  fetchDoctors,
} from "@/services/billing";
import { fetchGeneratedLabBills, fetchReportOptions } from "@/services/reports";
import {
  PATIENT_TYPE_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  PAY_MODE_OPTIONS,
  patientTypeLabel,
  paymentStatusLabel,
} from "@/types/reports";
import type {
  GeneratedLabBillReportRow,
  GeneratedLabBillsOrder,
  GeneratedLabBillsResponse,
  ReportPaymentStatus,
  ReportSelectOption,
} from "@/types/reports";
import { formatDateTime, formatMoney } from "@/lib/utils";

const PRESET_LIMIT = 20;

/** Keeps the bill grid (plus its header) at roughly half a desktop viewport. */
const TABLE_SCROLL_AREA = "max-h-[min(48vh,560px)]";

const ORDER_OPTIONS: ReportSelectOption[] = [
  { value: "date_desc", label: "Date: Newest first" },
  { value: "date_asc", label: "Date: Oldest first" },
];

interface Filters {
  fromDate: string;
  toDate: string;
  patientId: string;
  patientName: string;
  billNumber: string;
  patientTypes: string[];
  departmentId: string;
  doctorIds: string[];
  paymentModes: string[];
  collectedByIds: string[];
  paymentStatus: string;
  orderBy: GeneratedLabBillsOrder;
  discountedOnly: boolean;
}

const EMPTY_FILTERS: Filters = {
  fromDate: "",
  toDate: "",
  patientId: "",
  patientName: "",
  billNumber: "",
  patientTypes: [],
  departmentId: "",
  doctorIds: [],
  paymentModes: [],
  collectedByIds: [],
  paymentStatus: "",
  orderBy: "date_desc",
  discountedOnly: false,
};

function toCsv(values: string[]): string | undefined {
  return values.length > 0 ? values.join(",") : undefined;
}

export function GeneratedLabBillsContent() {
  const [filters, setFilters] = useState<Filters>(() => ({ ...EMPTY_FILTERS, fromDate: localToday(), toDate: localToday() }));
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [departments, setDepartments] = useState<ReportSelectOption[]>([]);
  const [doctors, setDoctors] = useState<ReportSelectOption[]>([]);
  const [payModes, setPayModes] = useState<ReportSelectOption[]>(PAY_MODE_OPTIONS);
  const [collectors, setCollectors] = useState<ReportSelectOption[]>([]);
  const [result, setResult] = useState<GeneratedLabBillsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const requestSequence = useRef(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const departmentsPromise = fetchDepartments().then((rows) =>
      rows
        .filter((row) => row.active !== false)
        .map((row) => ({ value: row.id, label: row.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    );
    const doctorsPromise = fetchDoctors({ limit: 500 }).then((rows) =>
      rows
        .filter((row) => row.active !== false)
        .map((row) => ({ value: row.id, label: row.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    );
    const optionsPromise = fetchReportOptions()
      .then((options) => {
        if (options.payModes.length > 0) setPayModes(options.payModes);
        setCollectors(
          options.collectedByUsers.map((user) => ({
            value: user.id,
            label: user.name,
          })),
        );
      })
      .catch(() => undefined);

    Promise.all([departmentsPromise, doctorsPromise, optionsPromise])
      .then(([deptRows, doctorRows]) => {
        setDepartments(deptRows);
        setDoctors(doctorRows);
      })
      .catch(() => {
        setDepartments([]);
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
        patientId: criteria.patientId.trim() || undefined,
        patientName: criteria.patientName.trim() || undefined,
        billNumber: criteria.billNumber.trim() || undefined,
        patientTypes: toCsv(criteria.patientTypes),
        departmentId: criteria.departmentId || undefined,
        referringDoctorIds: toCsv(criteria.doctorIds),
        paymentModes: toCsv(criteria.paymentModes),
        collectedByIds: toCsv(criteria.collectedByIds),
        paymentStatus: (criteria.paymentStatus || undefined) as
          | "paid"
          | "partial"
          | "unpaid"
          | undefined,
        orderBy: criteria.orderBy,
        discountedOnly: criteria.discountedOnly ? "1" : undefined,
      }) satisfies Parameters<typeof fetchGeneratedLabBills>[0],
    [],
  );

  const runFetch = useCallback(
    (targetPage: number, criteria: Filters) => {
      const sequence = ++requestSequence.current;
      fetchGeneratedLabBills(buildParams(targetPage, criteria))
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
    setApplied(EMPTY_FILTERS);
    setResult(null); setError(null); setLoading(false);
  }, []);

  const handlePageChange = useCallback(
    (targetPage: number) => {
      setLoading(true);
      runFetch(targetPage, applied);
    },
    [applied, runFetch],
  );

  const setFilter = useCallback(
    <K extends keyof Filters>(key: K, value: Filters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const toggleInList = useCallback(
    (key: "patientTypes" | "doctorIds" | "paymentModes" | "collectedByIds") =>
      (value: string) => {
        setFilters((prev) => {
          const current = prev[key];
          return {
            ...prev,
            [key]: current.includes(value)
              ? current.filter((item) => item !== value)
              : [...current, value],
          };
        });
      },
    [],
  );

  const setList = useCallback(
    (key: "patientTypes" | "doctorIds" | "paymentModes" | "collectedByIds") =>
      (values: string[]) => {
        setFilters((prev) => ({ ...prev, [key]: values }));
      },
    [],
  );

  const rows = useMemo(() => result?.data ?? [], [result]);

  const currentPage = result?.pagination.page ?? 1;
  const serialById = useMemo(() => {
    const start = (currentPage - 1) * PRESET_LIMIT;
    return new Map(rows.map((row, index) => [row.id, start + index + 1]));
  }, [currentPage, rows]);

  const find = useReportFind<GeneratedLabBillReportRow>(rows, (row) => [
    row.billNumber,
    row.patientName,
    row.patientId,
    patientTypeLabel(row.patientType),
    row.tests.join(" "),
    row.doctorName,
    row.payModeLabel,
    row.collectedBy,
  ]);

  const columns: ReportColumn<GeneratedLabBillReportRow>[] = useMemo(
    () => {
      const fields: ReportColumn<GeneratedLabBillReportRow>[] = [
      {
        key: "sNo",
        header: "SNo",
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
        key: "billDate",
        header: "Bill Date",
        className: "w-24 whitespace-nowrap",
        render: (row) => formatDateTime(row.billDate),
      },
      {
        key: "patientName",
        header: "Name",
        className: "w-40",
        render: (row) => (
          <span className="font-medium">{row.patientName}</span>
        ),
      },
      {
        key: "patientId",
        header: "Pat Id",
        className: "w-28 whitespace-nowrap",
        render: (row) => row.patientId,
      },
      {
        key: "patientType",
        header: "Patient Type",
        className: "w-24",
        render: (row) => patientTypeLabel(row.patientType),
      },
      {
        key: "tests",
        header: "Lab Test",
        className: "w-56",
        render: (row) => (
          <span>{row.tests.join(", ")}</span>
        ),
      },
      {
        key: "doctorName",
        header: "Dr Name",
        className: "w-36",
        render: (row) => row.doctorName,
      },
      {
        key: "totalAmount",
        header: "Total",
        className: "w-24 whitespace-nowrap text-right",
        align: "right",
        render: (row) => formatMoney(row.totalAmount),
      },
      {
        key: "discountAmount",
        header: "Dscnt",
        className: "w-24 whitespace-nowrap text-right",
        align: "right",
        render: (row) => formatMoney(row.discountAmount),
      },
      {
        key: "netAmount",
        header: "Net",
        className: "w-24 whitespace-nowrap text-right",
        align: "right",
        render: (row) => (
          <span className="font-semibold text-slate-800">
            {formatMoney(row.netAmount)}
          </span>
        ),
      },
      {
        key: "payModeLabel",
        header: "Pay Mode",
        className: "w-28",
        render: (row) => row.payModeLabel,
      },
      {
        key: "collectedBy",
        header: "User",
        className: "w-36",
        render: (row) => row.collectedBy,
      },
      { key: "paidAmount", header: "Paid", align: "right", render: (row) => formatMoney(row.paidAmount) },
      { key: "dueAmount", header: "Balance", align: "right", render: (row) => formatMoney(row.dueAmount) },
      {
        key: "paymentStatus",
        header: "Payment Status",
        className: "w-32 text-center",
        align: "center",
        render: (row) => {
          if (row.status === "cancelled") {
            return (
              <Badge variant="outline" className="border-red-200 text-red-600">
                CANCELLED
              </Badge>
            );
          }
          const tone =
            row.paymentStatus === "paid"
              ? "border-emerald-200 text-emerald-600"
              : row.paymentStatus === "partial"
                ? "border-amber-200 text-amber-600"
                : "border-red-200 text-red-600";
          return (
            <Badge variant="outline" className={tone}>
              {paymentStatusLabel(row.paymentStatus)}
            </Badge>
          );
        },
      },
      ];
      const order = ["sNo", "billDate", "billNumber", "patientId", "patientName", "doctorName", "tests", "totalAmount", "discountAmount", "netAmount", "paidAmount", "dueAmount", "collectedBy", "payModeLabel", "patientType", "paymentStatus"];
      return order.map((key) => fields.find((column) => column.key === key)!);
    },
    [serialById],
  );

  const criteriaText = useMemo(() => {
    const parts: string[] = [];
    const from = formatCriteriaDate(applied.fromDate);
    const to = formatCriteriaDate(applied.toDate);
    parts.push(`Date : ${from || "—"} to ${to || "—"}`);
    if (applied.billNumber.trim()) parts.push(`Bill No : ${applied.billNumber.trim()}`);
    if (applied.patientId.trim()) parts.push(`GPId : ${applied.patientId.trim()}`);
    if (applied.patientName.trim()) {
      parts.push(`Name : ${applied.patientName.trim()}`);
    }
    if (applied.patientTypes.length > 0) {
      const labels = applied.patientTypes
        .map((value) => patientTypeLabel(value))
        .join(", ");
      parts.push(`Patient Type : ${labels}`);
    }
    if (applied.departmentId) {
      const label =
        departments.find((row) => row.value === applied.departmentId)?.label ??
        applied.departmentId;
      parts.push(`Department : ${label}`);
    }
    if (applied.doctorIds.length > 0) {
      const labels = applied.doctorIds
        .map((value) => doctors.find((row) => row.value === value)?.label ?? value)
        .join(", ");
      parts.push(`Doctor : ${labels}`);
    }
    if (applied.paymentModes.length > 0) {
      const labels = applied.paymentModes
        .map((value) => payModes.find((row) => row.value === value)?.label ?? value)
        .join(", ");
      parts.push(`Pay Mode : ${labels}`);
    }
    if (applied.collectedByIds.length > 0) {
      const labels = applied.collectedByIds
        .map((value) => collectors.find((row) => row.value === value)?.label ?? value)
        .join(", ");
      parts.push(`Collected By : ${labels}`);
    }
    if (applied.paymentStatus) {
      parts.push(
        `Payment Status : ${paymentStatusLabel(applied.paymentStatus as ReportPaymentStatus)}`,
      );
    }
    parts.push(`Order : ${applied.orderBy === "date_asc" ? "Oldest first" : "Newest first"}`);
    if (applied.discountedOnly) parts.push("Discounted bills only");
    return parts.join("  |  ");
  }, [applied, collectors, departments, doctors, payModes]);

  const handleExport = async (format: ReportExportFormat = "excel") => {
    const response = await fetchGeneratedLabBills({ ...buildParams(1, applied), export: "1" });
    await downloadReport(reportCsvName("generated-lab-bills"),
      ["SNo", "Bill Date", "Bill No", "Pat Id", "Name", "Dr Name", "Lab Test", "Total", "Dscnt", "Net", "Paid", "Balance", "User", "Pay Mode", "Patient Type", "Payment Status"],
      response.data.map((row, index) => [String(index + 1), formatDateTime(row.billDate), row.billNumber, row.patientId, row.patientName, row.doctorName, row.tests.join(", "), formatMoney(row.totalAmount), formatMoney(row.discountAmount), formatMoney(row.netAmount), formatMoney(row.paidAmount), formatMoney(row.dueAmount), row.collectedBy, row.payModeLabel, patientTypeLabel(row.patientType), paymentStatusLabel(row.paymentStatus)]), format, criteriaText);
  };

  return (
    <div data-tmis-page="generated-lab-bills" className="lis-tmis lis-generated-report mx-auto flex max-w-[1800px] flex-col gap-2 p-2 sm:p-3">
      <ReportTitleBar
        title="Generated Lab Bills"
        subtitle="Generated lab bills with stored prices, discounts, payment mode and collector."
      />

      <ReportFilterBar
        compact
        onSearch={handleSearch}
        onClear={handleClear}
        searching={loading}
      >
        <div className="lis-generated-filter-columns">
        <div className="lis-generated-filter-lists mt-2 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
          <ReportSelectionPanel
            bare
            title="Patient Type"
            selectAllLabel="All"
            options={PATIENT_TYPE_OPTIONS}
            selected={filters.patientTypes}
            onToggle={toggleInList("patientTypes")}
            onSelectAll={setList("patientTypes")}
            onClear={() => setList("patientTypes")([])}
            searchPlaceholder="Search patient type…"
            maxHeightClassName="max-h-32"
          />
          <ReportSelectionPanel
            bare
            title="Payment Mode"
            selectAllLabel="All"
            options={payModes}
            selected={filters.paymentModes}
            onToggle={toggleInList("paymentModes")}
            onSelectAll={setList("paymentModes")}
            onClear={() => setList("paymentModes")([])}
            searchPlaceholder="Search payment mode…"
            maxHeightClassName="max-h-32"
          />
          <ReportSelectionPanel
            bare
            title="Referring Doctor"
            selectAllLabel="All"
            options={doctors}
            selected={filters.doctorIds}
            onToggle={toggleInList("doctorIds")}
            onSelectAll={setList("doctorIds")}
            onClear={() => setList("doctorIds")([])}
            searchPlaceholder="Search Doctor"
            maxHeightClassName="max-h-32"
          />
          <ReportSelectionPanel
            bare
            title="Collected By"
            selectAllLabel="All"
            options={collectors}
            selected={filters.collectedByIds}
            onToggle={toggleInList("collectedByIds")}
            onSelectAll={setList("collectedByIds")}
            onClear={() => setList("collectedByIds")([])}
            searchPlaceholder="Search Collected By"
            maxHeightClassName="max-h-32"
          />
        </div>
        <div className="lis-generated-filter-criteria grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          <ReportDateRange
            fromId="glb-from-date"
            toId="glb-to-date"
            fromValue={filters.fromDate}
            toValue={filters.toDate}
            onFromChange={(value) => setFilter("fromDate", value)}
            onToChange={(value) => setFilter("toDate", value)}
          />
          <ReportSearchInput
            id="glb-bill-number"
            label="Bill No"
            value={filters.billNumber}
            onChange={(value) => setFilter("billNumber", value)}
          />
          <ReportSearchInput
            id="glb-patient-id"
            label="GPId"
            value={filters.patientId}
            onChange={(value) => setFilter("patientId", value)}
          />
          <ReportSearchInput
            id="glb-patient-name"
            label="Patient Name"
            value={filters.patientName}
            onChange={(value) => setFilter("patientName", value)}
          />
          <ReportSelect
            id="glb-department"
            label="Department"
            value={filters.departmentId}
            onChange={(value) => setFilter("departmentId", value)}
            options={departments}
          />
          <ReportSelect
            id="glb-payment-status"
            label="Payment Status"
            value={filters.paymentStatus}
            onChange={(value) => setFilter("paymentStatus", value)}
            options={PAYMENT_STATUS_OPTIONS}
          />
          <ReportSelect
            id="glb-order-by"
            label="Date Order"
            value={filters.orderBy}
            onChange={(value) =>
              setFilter("orderBy", (value || "date_desc") as GeneratedLabBillsOrder)
            }
            options={ORDER_OPTIONS}
            placeholder="Newest first"
          />
          <div className="flex items-end pb-2">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
              <input
                id="glb-discounted-only"
                type="checkbox"
                checked={filters.discountedOnly}
                onChange={(event) => setFilter("discountedOnly", event.target.checked)}
                className="size-3.5 accent-primary"
              />
              Discounted bills only
            </label>
          </div>
        </div>

        </div>
      </ReportFilterBar>

      {(result || loading || error) && <ReportPreview
        reportTitle="Generated Lab Bills Report"
        criteria={criteriaText}
        total={result?.pagination.total ?? 0}
        unitLabel="bills"
      >
        {error ? (
          <p className="px-2.5 py-4 text-center text-sm text-red-600">{error}</p>
        ) : (
          <>
            <ReportTable
              columns={columns}
              data={rows}
              rowKey={(row) => row.id}
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
                findValue={find.findValue}
                onFindChange={find.onFindChange}
                matches={find.matches}
                onFindNext={find.onFindNext}
                unitLabel="bills"
              />
            )}
          </>
        )}
      </ReportPreview>}
      <section aria-label="Revenue Analytics" className="rounded border border-slate-200 bg-white p-3 text-xs">
        <h2 className="mb-1 text-sm font-medium">Revenue Analytics — Anjali Diagnostics</h2>
        <p className="mb-2 text-slate-600">{criteriaText}. Totals cover all matching generated bills; cancelled bills are excluded. Collections are current paid balances on bills in this bill-date range, not payments received during the range.</p>
        {loading ? <p>Loading revenue analytics…</p> : error ? <p role="alert" className="text-destructive">{error}</p> : !result ? <p>Select a date range and click Show to view analytics.</p> : <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            {[["Total billed", result.summary.totalAmount], ["Discounts", result.summary.totalDiscount], ["Net revenue", result.summary.totalNet], ["Collected", result.summary.totalPaid], ["Outstanding", result.summary.totalDue], ["Bills", result.summary.totalBills]].map(([label,value]) =>
              <div key={String(label)} className="rounded border p-2"><div className="text-slate-600">{label}</div><div className="mt-1 font-medium">{label === "Bills" ? value : formatMoney(Number(value))}</div></div>)}
          </div>
          {!result.summary.totalBills ? <p className="mt-2">No generated bills match this range and criteria.</p> : <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="max-h-56 overflow-auto"><h3 className="mb-1 font-medium">Revenue by bill day</h3><table className="w-full text-right"><thead><tr><th className="text-left">Day</th><th>Net</th><th>Collected</th><th>Outstanding</th></tr></thead><tbody>{result.analytics.daily.map((day) => <tr key={day.date} className="border-t"><td className="py-1 text-left">{formatCriteriaDate(day.date)}</td><td>{formatMoney(day.netAmount)}</td><td>{formatMoney(day.paidAmount)}</td><td>{formatMoney(day.dueAmount)}</td></tr>)}</tbody></table></div>
            <div><h3 className="mb-1 font-medium">Collected by stored bill payment mode</h3><p className="mb-1 text-slate-600">Groups paid bill balances by the bill’s recorded mode; mixed later payments are not a transaction-mode breakdown.</p>{result.analytics.paymentModes.map((mode) => <div key={mode.mode} className="flex justify-between border-t py-1"><span>{mode.mode}</span><span>{formatMoney(mode.paidAmount)}</span></div>)}</div>
          </div>}
        </>}
      </section>
    </div>
  );
}
