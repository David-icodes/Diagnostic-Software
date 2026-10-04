"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { ReportTruncatedCell } from "@/components/reports/report-truncated-cell";
import { useReportFind } from "@/components/reports/use-report-find";
import { formatCriteriaDate } from "@/components/reports/report-export";
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
import { formatDate, formatMoney } from "@/lib/utils";

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
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [departments, setDepartments] = useState<ReportSelectOption[]>([]);
  const [doctors, setDoctors] = useState<ReportSelectOption[]>([]);
  const [payModes, setPayModes] = useState<ReportSelectOption[]>(PAY_MODE_OPTIONS);
  const [collectors, setCollectors] = useState<ReportSelectOption[]>([]);
  const [result, setResult] = useState<GeneratedLabBillsResponse | null>(null);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    fetchGeneratedLabBills(buildParams(1, EMPTY_FILTERS))
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
      fetchGeneratedLabBills(buildParams(targetPage, criteria))
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
        key: "billDate",
        header: "Date",
        className: "w-24 whitespace-nowrap",
        render: (row) => formatDate(row.billDate),
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
        key: "patientId",
        header: "GPId",
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
        header: "Tests",
        className: "w-56",
        render: (row) => (
          <ReportTruncatedCell value={row.tests.join(", ")} />
        ),
      },
      {
        key: "doctorName",
        header: "Doctor",
        className: "w-36",
        render: (row) => <ReportTruncatedCell value={row.doctorName} />,
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
        header: "Discount",
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
        render: (row) => <ReportTruncatedCell value={row.payModeLabel} />,
      },
      {
        key: "collectedBy",
        header: "Collected By",
        className: "w-36",
        render: (row) => <ReportTruncatedCell value={row.collectedBy} />,
      },
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
    ],
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

  return (
    <div className="mx-auto flex max-w-[1800px] flex-col gap-2 p-2 sm:p-3">
      <ReportTitleBar
        title="Generated Lab Bills Report"
        subtitle="Generated lab bills with stored prices, discounts, payment mode and collector."
      />

      <ReportFilterBar
        compact
        onSearch={handleSearch}
        onClear={handleClear}
        searching={loading}
      >
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
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
            placeholder="e.g. OSP202600001"
          />
          <ReportSearchInput
            id="glb-patient-id"
            label="GPId"
            value={filters.patientId}
            onChange={(value) => setFilter("patientId", value)}
            placeholder="e.g. GP202600001"
          />
          <ReportSearchInput
            id="glb-patient-name"
            label="Patient Name"
            value={filters.patientName}
            onChange={(value) => setFilter("patientName", value)}
            placeholder="Enter patient name"
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

        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
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
      </ReportFilterBar>

      <ReportPreview
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
  );
}