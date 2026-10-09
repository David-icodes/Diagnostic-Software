"use client";

import { ReportPreview } from "@/components/reports/report-preview";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileBarChart2 } from "lucide-react";
import { CardContent } from "@/components/ui/card";
import { BillPageHeader } from "@/components/billing/bill-page-header";
import { ReportSelect } from "@/components/reports/report-select";
import { ReportFilterBar } from "@/components/reports/report-filter-bar";
import { ReportSummary } from "@/components/reports/report-summary";
import { ReportTable, type ReportColumn } from "@/components/reports/report-table";
import { ReportToolbar } from "@/components/reports/report-toolbar";
import { ReportPrintSheet, type PrintColumn } from "@/components/reports/report-print-sheet";
import { useReportFind } from "@/components/reports/use-report-find";
import {
  downloadCsv,
  reportCsvName,
} from "@/components/reports/report-export";
import { fetchDepartments } from "@/services/billing";
import { fetchHospitalPriceCard, fetchReportOptions } from "@/services/reports";
import { PRICE_CARD_STATUS_OPTIONS } from "@/types/reports";
import type {
  HospitalPriceCardResponse,
  HospitalPriceCardRow,
} from "@/types/reports";
import { updateLabTariffs } from "@/services/lab-masters";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils";

const PRESET_LIMIT = 20;

interface Filters {
  serviceType: string;
  departmentId: string;
  labName: string;
  status: string;
}

const EMPTY_FILTERS: Filters = {
  serviceType: "lab-test",
  departmentId: "",
  labName: "",
  status: "active",
};

function buildParams(targetPage: number, criteria: Filters) {
  return {
    page: targetPage,
    limit: PRESET_LIMIT,
    serviceType: criteria.serviceType || undefined,
    departmentId: criteria.departmentId || undefined,
    labName: criteria.labName || undefined,
    status: criteria.status || undefined,
  };
}

function amountCell(value: number | null): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }
  return <span className="font-medium text-slate-800">{formatMoney(value)}</span>;
}

export function HospitalPriceCardContent() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [serviceTypes, setServiceTypes] = useState<{ value: string; label: string }[]>([]);
  const [labNames, setLabNames] = useState<{ value: string; label: string }[]>([]);
  const [departments, setDepartments] = useState<{ value: string; label: string }[]>([]);
  const [result, setResult] = useState<HospitalPriceCardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printRows, setPrintRows] = useState<HospitalPriceCardRow[]>([]);
  const [printing, setPrinting] = useState(false);
  const requestSequence = useRef(0);
  const [editing, setEditing] = useState<HospitalPriceCardRow | null>(null);
  const [prices, setPrices] = useState({ price: "", priceIp: "", priceInsIp: "", priceEr: "" });
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    const departmentsPromise = fetchDepartments().then((rows) =>
      rows
        .filter((row) => row.active !== false)
        .map((row) => ({ value: row.id, label: row.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    );
    const optionsPromise = fetchReportOptions().then((options) => ({
      serviceTypes: options.priceCard.serviceTypes,
      labNames: options.priceCard.labNames,
    }));
    Promise.all([departmentsPromise, optionsPromise])
      .then(([deptRows, options]) => {
        setDepartments(deptRows);
        setServiceTypes(options.serviceTypes);
        setLabNames(options.labNames);
      })
      .catch(() => {
        setDepartments([]);
        setServiceTypes([]);
        setLabNames([]);
      });
  }, []);

  const runFetch = useCallback((targetPage: number, criteria: Filters) => {
    const sequence = ++requestSequence.current;
    fetchHospitalPriceCard(buildParams(targetPage, criteria))
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
  }, []);

  const handleSearch = useCallback(() => {
    setApplied(filters);
    setLoading(true);
    runFetch(1, filters);
  }, [filters, runFetch]);

  const handleClear = useCallback(() => {
    requestSequence.current += 1;
    setFilters(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setResult(null);
    setPrintRows([]);
    setError(null);
    setLoading(false);
    setEditing(null);
    setEditError(null);
  }, []);

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

  const find = useReportFind<HospitalPriceCardRow>(rows, (row) => [
    row.departmentName,
    row.testName,
  ]);

  const summaryItems = useMemo(() => {
    if (!result) return [];
    return [{ label: "Total Tests", value: result.summary.totalTests }];
  }, [result]);

  const beginEdit = useCallback((row: HospitalPriceCardRow) => {
    setEditing(row);
    setEditError(null);
    setPrices({ price: String(row.opAmount ?? ""), priceIp: String(row.ipAmount ?? ""), priceInsIp: String(row.insIpAmount ?? ""), priceEr: String(row.erAmount ?? "") });
  }, []);
  const saveEdit = async () => {
    if (!editing || saving) return;
    const parsed = Object.fromEntries(Object.entries(prices).map(([key, value]) => [key, value.trim() === "" ? undefined : Number(value)]));
    if (parsed.price === undefined || Object.values(parsed).some((value) => value !== undefined && (!Number.isFinite(value) || value < 0 || value > 99999999))) {
      setEditError("Enter valid tariff amounts. OP amount is required.");
      return;
    }
    setSaving(true);
    try {
      await updateLabTariffs([{ testId: editing.id, price: parsed.price, priceIp: parsed.priceIp, priceInsIp: parsed.priceInsIp, priceEr: parsed.priceEr }]);
      setEditing(null);
      setLoading(true);
      runFetch(result?.pagination.page ?? 1, applied);
    } catch (error) { setEditError(error instanceof Error ? error.message : "Unable to update tariffs"); }
    finally { setSaving(false); }
  };

  const columns: ReportColumn<HospitalPriceCardRow>[] = useMemo(
    () => [
      { key: "actions", header: "Edit", render: (row) => <Button type="button" size="sm" variant="outline" aria-label={`Edit ${row.testName}`} onClick={() => beginEdit(row)}>Edit</Button> },
      {
        key: "departmentName",
        header: "Dept Name",
        render: (row) => (
          <span className="font-medium text-slate-800">{row.departmentName}</span>
        ),
      },
      {
        key: "testName",
        header: "Name",
        render: (row) => row.testName,
      },
      {
        key: "opAmount",
        header: "OP Amt",
        align: "right",
        render: (row) => amountCell(row.opAmount),
      },
      {
        key: "ipAmount",
        header: "IP Amt",
        align: "right",
        render: (row) => amountCell(row.ipAmount),
      },
      {
        key: "insIpAmount",
        header: "Ins IP Amt",
        align: "right",
        render: (row) => amountCell(row.insIpAmount),
      },
      {
        key: "erAmount",
        header: "ER Amt",
        align: "right",
        render: (row) => amountCell(row.erAmount),
      },
      {
        key: "insErAmount",
        header: "Ins ER Amt",
        align: "right",
        render: (row) => amountCell(row.insErAmount),
      },
    ],
    [beginEdit],
  );

  const printColumns: PrintColumn<HospitalPriceCardRow>[] = useMemo(
    () => [
      { key: "departmentName", header: "Dept Name", render: (row) => row.departmentName },
      { key: "testName", header: "Name", render: (row) => row.testName },
      { key: "opAmount", header: "OP Amt (Rs.)", render: (row) => printAmount(row.opAmount), align: "right" },
      { key: "ipAmount", header: "IP Amt (Rs.)", render: (row) => printAmount(row.ipAmount), align: "right" },
      { key: "insIpAmount", header: "Ins IP Amt (Rs.)", render: (row) => printAmount(row.insIpAmount), align: "right" },
      { key: "erAmount", header: "ER Amt (Rs.)", render: (row) => printAmount(row.erAmount), align: "right" },
      { key: "insErAmount", header: "Ins ER Amt (Rs.)", render: (row) => printAmount(row.insErAmount), align: "right" },
    ],
    [],
  );

  const criteriaText = useMemo(
    () =>
      `Service Type : ${serviceTypes.find((item) => item.value === applied.serviceType)?.label ?? "All"}  ·  Department : ${
        departments.find((item) => item.value === applied.departmentId)?.label ?? "All"
      }  ·  Lab Name : ${
        labNames.find((item) => item.value === applied.labName)?.label ?? "All"
      }  ·  Status : ${
        PRICE_CARD_STATUS_OPTIONS.find((item) => item.value === applied.status)?.label ?? "All"
      }`,
    [applied, serviceTypes, departments, labNames],
  );

  const handleExport = useCallback(() => {
    if (!result) return;
    fetchHospitalPriceCard({ ...buildParams(1, applied), export: "1" })
      .then((response) => {
        downloadCsv(
          reportCsvName("hospital-price-card-report"),
          printColumns.map((column) => column.header),
          response.data.map((row) => printColumns.map((column) => column.render(row))),
        );
      })
      .catch(() => setError("Unable to export the report. Please try again."));
  }, [result, applied, printColumns]);

  const handlePrint = useCallback(() => {
    if (!result || printing) return;
    setPrinting(true);
    fetchHospitalPriceCard({ ...buildParams(1, applied), export: "1" })
      .then((response) => {
        setPrintRows(response.data);
        window.setTimeout(() => window.print(), 0);
      })
      .catch(() => setError("Unable to print the report. Please try again."))
      .finally(() => setPrinting(false));
  }, [result, applied, printing]);

  const tariffNote = useMemo(() => result?.meta?.tariffsNote ?? null, [result]);

  return (
    <>
      <div data-tmis-page="hospital-price-card" className="lis-tmis lis-report-page space-y-3 print:hidden">
        <BillPageHeader
          icon={FileBarChart2}
          title="Hospital Price Card"
          subtitle="Price list of lab tests for hospital charges."
        />

        {tariffNote && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">
            {tariffNote}
          </div>
        )}

        {editing && <section className="lis-price-edit border border-slate-300 bg-white p-3">
          <h2 className="text-sm font-semibold">Edit {editing.testName}</h2>
          <div className="grid grid-cols-4 gap-3 py-2">
            {([['price','OP Amt'],['priceIp','IP Amt'],['priceInsIp','Ins IP Amt'],['priceEr','ER Amt']] as const).map(([key,label]) => <label key={key} className="text-xs">{label}<Input aria-label={`Edit ${label}`} type="number" min="0" step="0.01" value={prices[key]} disabled={saving} onChange={(event) => setPrices((current) => ({ ...current, [key]: event.target.value }))} /></label>)}
          </div>
          {editError && <p role="alert" className="text-sm text-red-700">{editError}</p>}
          <Button type="button" size="sm" disabled={saving} onClick={() => void saveEdit()}>Update</Button>
          <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => setEditing(null)}>Cancel</Button>
        </section>}
        <ReportFilterBar
          onSearch={handleSearch}
          onClear={handleClear}
          searching={loading}
        >
          <div className="lis-price-filter-columns grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ReportSelect
              id="pcard-service-type"
              label="Service Type"
              value={filters.serviceType}
              onChange={(value) => setFilter("serviceType", value)}
              options={serviceTypes}
              placeholder="All"
            />
            <ReportSelect
              id="pcard-department"
              label="Select Department"
              value={filters.departmentId}
              onChange={(value) => setFilter("departmentId", value)}
              options={departments}
              placeholder="--Select--"
            />
            <ReportSelect
              id="pcard-lab-name"
              label="Select Lab Name"
              value={filters.labName}
              onChange={(value) => setFilter("labName", value)}
              options={labNames}
              placeholder="--Select--"
            />
            <ReportSelect
              id="pcard-status"
              label="Status"
              value={filters.status}
              onChange={(value) => setFilter("status", value)}
              options={PRICE_CARD_STATUS_OPTIONS}
              placeholder="All"
            />
          </div>
        </ReportFilterBar>

        <ReportSummary items={summaryItems} />

        {(result || loading || error) && <ReportPreview reportTitle="Hospital Price Card" criteria={criteriaText} total={result?.pagination.total ?? 0} className="lis-tmis-document">
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
        </ReportPreview>}
      </div>

      <ReportPrintSheet
        rows={printRows}
        columns={printColumns}
        title="Hospital Price Card"
        subtitle="Lab test price list"
        criteria={criteriaText}
        generatedAt={new Date().toISOString()}
        summaryNote={
          result ? `Total Tests : ${result.summary.totalTests}` : undefined
        }
      />
    </>
  );
}

function printAmount(value: number | null): string {
  return value === null || value === undefined ? "" : formatMoney(value);
}