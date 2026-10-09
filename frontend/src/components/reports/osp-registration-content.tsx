"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { localToday } from "@/lib/report-filter-state";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ReportDateRange } from "@/components/reports/report-date-range";
import { ReportSearchInput } from "@/components/reports/report-search-input";
import { ReportSelect } from "@/components/reports/report-select";
import { ReportFilterBar } from "@/components/reports/report-filter-bar";
import {
  REPORT_EMPTY_MESSAGE,
  ReportTable,
  type ReportColumn,
} from "@/components/reports/report-table";
import { ReportTitleBar } from "@/components/reports/report-title-bar";
import { ReportPreview } from "@/components/reports/report-preview";
import {
  REPORT_EM_DASH as EM_DASH,
  ReportTruncatedCell as TruncatedCell,
} from "@/components/reports/report-truncated-cell";
import { ReportToolbar } from "@/components/reports/report-toolbar";
import { formatCriteriaDate } from "@/components/reports/report-export";
import { useReportFind } from "@/components/reports/use-report-find";
import { fetchOspRegistration } from "@/services/reports";
import { deletePatient } from "@/services/patients";
import { queryKeys, invalidateRoots } from "@/lib/query-keys";
import { ApiError } from "@/lib/api";
import {
  BILL_TYPE_OPTIONS,
  GENDER_FILTER_OPTIONS,
} from "@/types/reports";
import type {
  OspRegistrationReportRow,
  OspRegistrationResponse,
} from "@/types/reports";
import {
  formatAgeYearsMonthsDays,
  formatDate,
  formatGender,
} from "@/lib/utils";

const PRESET_LIMIT = 20;

/** Keeps the grid (plus its header) at roughly half a desktop viewport. */
const TABLE_SCROLL_AREA = "max-h-[min(46vh,520px)]";

interface Filters {
  fromDate: string;
  toDate: string;
  gender: string;
  mobile: string;
  name: string;
  billType: string;
}

const EMPTY_FILTERS: Filters = {
  fromDate: "",
  toDate: "",
  gender: "",
  mobile: "",
  name: "",
  billType: "",
};

/** Age is derived from the stored date of birth, never from a cached value. */
function formatAge(row: OspRegistrationReportRow): string {
  const fromDob = formatAgeYearsMonthsDays(row.dateOfBirth);
  if (fromDob) return fromDob;
  if (row.age !== null && row.age !== undefined) return `${row.age} yrs`;
  return EM_DASH;
}

export function OspRegistrationContent() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Filters>(() => ({ ...EMPTY_FILTERS, fromDate: localToday(), toDate: localToday() }));
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [result, setResult] = useState<OspRegistrationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const requestSequence = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] =
    useState<OspRegistrationReportRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const buildParams = useCallback(
    (targetPage: number, criteria: Filters) =>
      ({
        page: targetPage,
        limit: PRESET_LIMIT,
        fromDate: criteria.fromDate || undefined,
        toDate: criteria.toDate || undefined,
        gender: criteria.gender || undefined,
        mobile: criteria.mobile.trim() || undefined,
        name: criteria.name.trim() || undefined,
        billType: criteria.billType || undefined,
      }) satisfies Parameters<typeof fetchOspRegistration>[0],
    [],
  );

  const load = useCallback(
    (targetPage: number, criteria: Filters) => {
      const sequence = ++requestSequence.current;
      return fetchOspRegistration(buildParams(targetPage, criteria))
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
    setNotice(null);
    setLoading(true);
    void load(1, filters);
  }, [filters, load]);

  const handleClear = useCallback(() => {
    requestSequence.current += 1;
    setFilters({ ...EMPTY_FILTERS, fromDate: localToday(), toDate: localToday() });
    setApplied(EMPTY_FILTERS); setNotice(null); setResult(null); setError(null); setLoading(false);
  }, []);

  const handlePageChange = useCallback(
    (targetPage: number) => {
      setLoading(true);
      void load(targetPage, applied);
    },
    [applied, load],
  );

  const setFilter = useCallback((key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const rows = useMemo(() => result?.data ?? [], [result]);

  // S No is the position in the full result set, not the row index on the page.
  const currentPage = result?.pagination.page ?? 1;
  const serialById = useMemo(() => {
    const start = (currentPage - 1) * PRESET_LIMIT;
    return new Map(rows.map((row, index) => [row.id, start + index + 1]));
  }, [currentPage, rows]);

  const find = useReportFind<OspRegistrationReportRow>(rows, (row) => [
    row.patientId,
    row.patientName,
    formatGender(row.gender),
    row.mobile,
  ]);

  const openDeleteDialog = useCallback((row: OspRegistrationReportRow) => {
    setDeleteError(null);
    setPendingDelete(row);
  }, []);

  const closeDeleteDialog = useCallback(() => {
    if (deleting) return;
    setPendingDelete(null);
    setDeleteError(null);
  }, [deleting]);

  const confirmDelete = useCallback(async () => {
    const target = pendingDelete;
    if (!target || deleting) return;

    setDeleting(true);
    setDeleteError(null);
    try {
      // The backend resolves the row by its database id and permanently removes
      // the registration together with every operational record that references
      // it, then verifies nothing was left behind.
      const response = await deletePatient(target.id);
      setPendingDelete(null);
      setNotice(
        `${response.patientId} (${response.fullName}) deleted. ${response.summary}`,
      );
      // A deletion invalidates every patient-owned read: the registry, every bill
      // list (result entry, reprint, modify, dashboards), samples and results.
      await invalidateRoots(
        queryClient,
        queryKeys.patients,
        queryKeys.labBills,
        queryKeys.labSamples,
        queryKeys.testResults,
        queryKeys.dashboard,
      );
      await load(result?.pagination.page ?? 1, applied);
    } catch (caught) {
      setDeleteError(
        caught instanceof ApiError
          ? caught.message
          : "Unable to delete this registration. Please try again.",
      );
    } finally {
      setDeleting(false);
      setLoading(false);
    }
  }, [applied, deleting, load, pendingDelete, queryClient, result]);

  const columns: ReportColumn<OspRegistrationReportRow>[] = useMemo(
    () => [
      {
        key: "sNo",
        header: "S No",
        className: "w-12",
        align: "center",
        render: (row) => serialById.get(row.id) ?? "",
      },
      {
        key: "registrationDate",
        header: "Date",
        className: "w-24 whitespace-nowrap",
        render: (row) => formatDate(row.registrationDate),
      },
      {
        key: "patientId",
        header: "GPId",
        className: "w-28 whitespace-nowrap font-medium text-slate-800",
        render: (row) => row.patientId,
      },
      {
        key: "patientName",
        header: "Name",
        className: "w-44",
        render: (row) => (
          <TruncatedCell value={row.patientName} className="font-medium" />
        ),
      },
      {
        key: "age",
        header: "Age",
        className: "w-24 whitespace-nowrap",
        render: (row) => formatAge(row),
      },
      {
        key: "gender",
        header: "Gender",
        className: "w-20 whitespace-nowrap",
        render: (row) => formatGender(row.gender),
      },
      {
        key: "mobile",
        header: "Mobile",
        className: "w-28 whitespace-nowrap",
        render: (row) => row.mobile || EM_DASH,
      },
      {
        key: "address",
        header: "Address",
        className: "min-w-[180px]",
        render: (row) => <TruncatedCell value={row.address} />,
      },
      {
        key: "billFor",
        header: "Bill For",
        className: "w-20 whitespace-nowrap",
        render: () => "Lab",
      },
      {
        key: "delete",
        header: "Delete",
        className: "w-20",
        align: "center",
        render: (row) => (
          <Button
            type="button"
            variant="destructive"
            size="xs"
            disabled={deleting && pendingDelete?.id === row.id}
            title={`Delete ${row.patientId} — ${row.patientName}`}
            onClick={() => openDeleteDialog(row)}
          >
            <Trash2 className="size-3" />
            Delete
          </Button>
        ),
      },
    ],
    [deleting, openDeleteDialog, pendingDelete?.id, serialById],
  );

  const criteriaText = useMemo(() => {
    const parts: string[] = [];
    const from = formatCriteriaDate(applied.fromDate);
    const to = formatCriteriaDate(applied.toDate);
    parts.push(`Date : ${from || "—"} to ${to || "—"}`);
    if (applied.gender) {
      const label =
        GENDER_FILTER_OPTIONS.find((o) => o.value === applied.gender)?.label ??
        applied.gender;
      parts.push(`Gender : ${label}`);
    }
    if (applied.mobile.trim()) parts.push(`Mobile : ${applied.mobile.trim()}`);
    if (applied.name.trim()) parts.push(`Name : ${applied.name.trim()}`);
    if (applied.billType) {
      const label =
        BILL_TYPE_OPTIONS.find((o) => o.value === applied.billType)?.label ??
        applied.billType;
      parts.push(`Bill Type : ${label}`);
    }
    return parts.join("  |  ");
  }, [applied]);

  return (
    <div data-tmis-page="osp-registration" className="lis-tmis mx-auto flex max-w-[1800px] flex-col gap-2 p-2 sm:p-3">
      <ReportTitleBar
        title="General Patient Registration Report"
        subtitle="Registrations created within the selected date range."
      />

      <ReportFilterBar
        compact
        onSearch={handleSearch}
        onClear={handleClear}
        searching={loading}
      >
        <div className="lis-registration-fields grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
<ReportDateRange
            fromId="osp-from-date"
            toId="osp-to-date"
            fromValue={filters.fromDate}
            toValue={filters.toDate}
            onFromChange={(value) => setFilter("fromDate", value)}
            onToChange={(value) => setFilter("toDate", value)}
          />
<ReportSelect
            id="osp-gender"
            label="Gender"
            value={filters.gender}
            onChange={(value) => setFilter("gender", value)}
            options={GENDER_FILTER_OPTIONS}
          />
<ReportSearchInput
            id="osp-mobile"
            label="Mobile No"
            value={filters.mobile}
            onChange={(value) => setFilter("mobile", value)}

          />
<ReportSearchInput
            id="osp-name"
            label="Patient Name"
            value={filters.name}
            onChange={(value) => setFilter("name", value)}

          />
<ReportSelect
            id="osp-bill-type"
            label="Bill Type"
            value={filters.billType}
            onChange={(value) => setFilter("billType", value)}
            options={BILL_TYPE_OPTIONS}
          />
        </div>
      </ReportFilterBar>

      {notice && !error && (
        <p
          role="status"
          className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-700"
        >
          {notice}
        </p>
      )}

      {(result || loading || error) && <ReportPreview
        reportTitle="GP Patients Report"
        criteria={criteriaText}
        total={result?.pagination.total ?? 0}
        unitLabel="patients"
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
                findValue={find.findValue}
                onFindChange={find.onFindChange}
                matches={find.matches}
                onFindNext={find.onFindNext}
                unitLabel="patients"
              />
            )}
          </>
        )}
      </ReportPreview>}

      <Dialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) closeDeleteDialog();
        }}
        title="Delete patient"
        description="Delete this patient and all associated laboratory records?"
      >
        {pendingDelete && (
          <div className="space-y-3">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted-foreground">GPId</dt>
              <dd className="font-medium">{pendingDelete.patientId}</dd>
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">{pendingDelete.patientName}</dd>
              <dt className="text-muted-foreground">Mobile</dt>
              <dd>{pendingDelete.mobile || EM_DASH}</dd>
            </dl>

            {deleteError && (
              <p
                role="alert"
                className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700"
              >
                {deleteError}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={closeDeleteDialog}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => void confirmDelete()}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
