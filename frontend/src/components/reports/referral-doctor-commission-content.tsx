"use client";



import { localToday } from "@/lib/report-filter-state";

import { ReportPreview } from "@/components/reports/report-preview";



import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { FileBarChart2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import { CardContent } from "@/components/ui/card";

import { BillPageHeader } from "@/components/billing/bill-page-header";

import { ReportDateRange } from "@/components/reports/report-date-range";

import { ReportSearchInput } from "@/components/reports/report-search-input";

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

import { fetchDepartments, fetchDoctors, fetchLabTests } from "@/services/billing";

import { fetchReferralDoctorCommission } from "@/services/reports";

import {

  COMMISSION_CLAIM_TYPE_OPTIONS,

  COMMISSION_PATIENT_TYPE_OPTIONS,

  patientTypeLabel,

} from "@/types/reports";

import type {

  ReferralDoctorCommissionResponse,

  ReferralDoctorCommissionRow,

  ReportSelectOption,

} from "@/types/reports";

import { formatDate, formatMoney } from "@/lib/utils";



const PRESET_LIMIT = 20;



interface Filters {

  fromDate: string;

  toDate: string;

  doctorIds: string[];

  departmentIds: string[];

  testIds: string[];

  patientId: string;

  patientTypes: string[];

  commissionBasis: string;

  amountBasis: string;

  claimType: string;

}



const EMPTY_FILTERS: Filters = {

  fromDate: "",

  toDate: "",

  doctorIds: [],

  departmentIds: [],

  testIds: [],

  patientId: "",

  patientTypes: [],

  commissionBasis: "referral",

  amountBasis: "net",

  claimType: "",

};



export function ReferralDoctorCommissionContent() {

  const [filters, setFilters] = useState<Filters>(() => ({ ...EMPTY_FILTERS, fromDate: localToday(), toDate: localToday() }));

  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);

  const [doctors, setDoctors] = useState<ReportSelectOption[]>([]);

  const [departments, setDepartments] = useState<ReportSelectOption[]>([]);

  const [tests, setTests] = useState<(ReportSelectOption & { departmentId: string })[]>([]);

  const [result, setResult] = useState<ReferralDoctorCommissionResponse | null>(null);

  const [loading, setLoading] = useState(false);

  const requestSequence = useRef(0);

  const [error, setError] = useState<string | null>(null);

  const [printRows, setPrintRows] = useState<ReferralDoctorCommissionRow[]>([]);

  const [printing, setPrinting] = useState(false);



  useEffect(() => {

    Promise.all([

      fetchDoctors({ limit: 500 }).then((rows) =>

        rows

          .filter((row) => row.active !== false)

          .map((row) => ({ value: row.id, label: row.name }))

          .sort((a, b) => a.label.localeCompare(b.label)),

      ),

      fetchDepartments().then((rows) =>

        rows

          .filter((row) => row.active !== false)

          .map((row) => ({ value: row.id, label: row.name }))

          .sort((a, b) => a.label.localeCompare(b.label)),

      ),

      fetchLabTests({ limit: 1000, status: "active" }).then((res) =>

        res.items

          .filter((row) => row.active !== false)

          .map((row) => ({ value: row.id, label: row.testName, departmentId: row.departmentId }))

          .sort((a, b) => a.label.localeCompare(b.label)),

      ),

    ])

      .then(([doctorRows, deptRows, testRows]) => {

        setDoctors(doctorRows);

        setDepartments(deptRows);

        setTests(testRows);

      })

      .catch(() => {

        setDoctors([]);

        setDepartments([]);

        setTests([]);

      });

  }, []);



  const buildParams = useCallback(

    (targetPage: number, criteria: Filters) =>

      ({

        page: targetPage,

        limit: PRESET_LIMIT,

        fromDate: criteria.fromDate || undefined,

        toDate: criteria.toDate || undefined,

        doctorIds: criteria.doctorIds.length ? criteria.doctorIds.join(",") : undefined,

        departmentIds: criteria.departmentIds.length

          ? criteria.departmentIds.join(",")

          : undefined,

        testIds: criteria.testIds.length ? criteria.testIds.join(",") : undefined,

        patientId: criteria.patientId.trim() || undefined,

        patientTypes: criteria.patientTypes.length

          ? criteria.patientTypes.join(",")

          : undefined,

        commissionBasis: (criteria.commissionBasis || undefined) as

          | "referral"

          | "cons_op_ip"

          | undefined,

        amountBasis: (criteria.amountBasis || undefined) as

          | "net"

          | "paid"

          | undefined,

        claimType: criteria.claimType || undefined,

      }) satisfies Parameters<typeof fetchReferralDoctorCommission>[0],

    [],

  );



  const runExport = useCallback(

    (criteria: Filters) =>

      fetchReferralDoctorCommission({ ...buildParams(1, criteria), export: "1" }).then(

        (response) => response.data,

      ),

    [buildParams],

  );



  const runFetch = useCallback(

    (targetPage: number, criteria: Filters) => {

      const sequence = ++requestSequence.current;

      fetchReferralDoctorCommission(buildParams(targetPage, criteria))

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



  const toggleSelection = useCallback(

    (key: "doctorIds" | "departmentIds" | "testIds" | "patientTypes", value: string) => {

      setFilters((prev) => {

        const current = prev[key];

        const next = current.includes(value)

          ? current.filter((item) => item !== value)

          : [...current, value];

        return { ...prev, [key]: next };

      });

    },

    [],

  );



  const selectAll = useCallback(

    (key: "doctorIds" | "departmentIds" | "testIds" | "patientTypes", values: string[]) => {

      setFilters((prev) => ({ ...prev, [key]: values }));

    },

    [],

  );



  const clearSelections = useCallback(

    (key: "doctorIds" | "departmentIds" | "testIds" | "patientTypes") => {

      setFilters((prev) => ({ ...prev, [key]: [] }));

    },

    [],

  );



  const rows = useMemo(() => result?.data ?? [], [result]);



  const find = useReportFind<ReferralDoctorCommissionRow>(rows, (row) => [

    row.billNumber,

    row.patientName,

    row.patientId,

    row.doctorName,

    row.tests,

    row.configMissing ? "missing config" : "config",

  ]);



  const summaryItems = useMemo(() => {

    if (!result) return [];

    return [

      { label: "Total Bills", value: result.summary.totalBills },

      { label: "Bill Net", value: formatMoney(result.summary.totalNet) },

      { label: "Bill Paid", value: formatMoney(result.summary.totalPaid) },

      { label: "Total Commission", value: formatMoney(result.summary.totalCommission) },

      { label: "Missing Config", value: result.summary.missingConfigs },

    ];

  }, [result]);



  const metaNote = useMemo(() => {

    if (!result?.meta) return "";

    const basis =

      result.meta.commissionBasis === "cons_op_ip"

        ? "Commission Basis : Consolidated (OP + IP)"

        : "Commission Basis : Billwise (Referral)";

    return `${basis}  ·  Amount Basis : ${

      result.meta.amountBasis === "paid" ? "Paid Amount" : "Bill Net"

    }  ·  Claim Types : ${result.meta.claimTypes.join(", ")}`;

  }, [result]);



  const columns: ReportColumn<ReferralDoctorCommissionRow>[] = useMemo(

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

        key: "patientType",

        header: "Patient Type",

        render: (row) => patientTypeLabel(row.patientType),

      },

      {

        key: "doctor",

        header: "Doctor",

        render: (row) => row.doctorName,

      },

      {

        key: "tests",

        header: "Test",

        render: (row) => <span className="text-xs text-slate-600">{row.tests}</span>,

      },

      {

        key: "segmentNet",

        header: "Bill Net",

        align: "right",

        render: (row) => formatMoney(row.segmentNet),

      },

      {

        key: "segmentPaid",

        header: "Bill Paid",

        align: "right",

        render: (row) => formatMoney(row.segmentPaid),

      },

      {

        key: "rateUsed",

        header: "Rate",

        align: "right",

        render: (row) => (row.rateUsed === null ? "—" : `${row.rateUsed}%`),

      },

      {

        key: "commission",

        header: "Commission",

        align: "right",

        render: (row) =>

          row.configMissing ? (

            <Badge variant="outline" className="border-amber-200 text-amber-600">

              Missing

            </Badge>

          ) : row.commissionAmount === null ? (

            <span className="text-muted-foreground">—</span>

          ) : (

            <span

              className={

                row.commissionAmount === 0

                  ? "text-muted-foreground"

                  : "font-semibold text-slate-800"

              }

            >

              {formatMoney(row.commissionAmount)}

            </span>

          ),

      },

    ],

    [],

  );



  const printColumns: PrintColumn<ReferralDoctorCommissionRow>[] = useMemo(

    () => [

      { key: "billNumber", header: "Bill No", render: (row) => row.billNumber },

      { key: "billDate", header: "Bill Date", render: (row) => formatDate(row.billDate) },

      { key: "patient", header: "Patient Name", render: (row) => row.patientName },

      { key: "patientId", header: "Patient ID", render: (row) => row.patientId },

      { key: "patientType", header: "Patient Type", render: (row) => patientTypeLabel(row.patientType) },

      { key: "doctor", header: "Doctor", render: (row) => row.doctorName },

      { key: "tests", header: "Test", render: (row) => row.tests },

      { key: "segmentNet", header: "Bill Net (Rs.)", render: (row) => formatMoney(row.segmentNet), align: "right" },

      { key: "segmentPaid", header: "Bill Paid (Rs.)", render: (row) => formatMoney(row.segmentPaid), align: "right" },

      {

        key: "rateUsed",

        header: "Rate (%)",

        render: (row) => (row.rateUsed === null ? "" : String(row.rateUsed)),

        align: "right",

      },

      {

        key: "commission",

        header: "Commission (Rs.)",

        render: (row) => (row.commissionAmount === null ? "" : String(row.commissionAmount)),

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

    if (applied.doctorIds.length) {

      parts.push(

        `Doctor : ${applied.doctorIds

          .map((id) => doctors.find((d) => d.value === id)?.label ?? id)

          .join(", ")}`,

      );

    }

    if (applied.departmentIds.length) {

      parts.push(`Department : ${applied.departmentIds.join(", ")}`);

    }

    if (applied.testIds.length) parts.push(`Test : ${applied.testIds.join(", ")}`);

    if (applied.patientId) parts.push(`Patient ID : ${applied.patientId}`);

    if (applied.patientTypes.length) {

      parts.push(`Patient Type : ${applied.patientTypes.join(", ")}`);

    }

    if (applied.commissionBasis) {

      parts.push(

        `Commission Basis : ${

          applied.commissionBasis === "cons_op_ip" ? "Consolidated (OP + IP)" : "Billwise (Referral)"

        }`,

      );

    }

    if (applied.amountBasis) parts.push(`Amount Basis : ${applied.amountBasis}`);

    if (applied.claimType) parts.push(`Claim Type : ${applied.claimType}`);

    return parts.join("  |  ");

  }, [applied, doctors]);



  const handleExport = useCallback(() => {

    if (!result) return;

    runExport(applied)

      .then((rows) => {

        downloadCsv(

          reportCsvName("referral-doctor-commission-report"),

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

      <div data-tmis-page="referral-doctor-commission" className="lis-tmis lis-report-page space-y-3 print:hidden">

        <BillPageHeader

          icon={FileBarChart2}

          title="Lab - Dr Referral - Bill wise"

          subtitle="Bill-wise referral doctor commission on referred tests."

        />



        {metaNote && (

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">

            {metaNote}

          </div>

        )}



        <ReportFilterBar homeBeforeClear onSearch={handleSearch} onClear={handleClear} searching={loading}>

          <div className="lis-referral-rebuilt">

            <div className="lis-referral-master-lists">

              {([{ key: "departmentIds", title: "Department", options: departments },

                 { key: "testIds", title: "Test", options: tests.filter((test) => !filters.departmentIds.length || filters.departmentIds.includes(test.departmentId)) },

                 { key: "doctorIds", title: "Doctor", options: doctors }] as const).map((panel) => (

                <ReportSelectionPanel key={panel.key} title={panel.title} options={[...panel.options]} selected={filters[panel.key]}

                  onToggle={(value) => toggleSelection(panel.key, value)} onSelectAll={(values) => selectAll(panel.key, values)}

                  onClear={() => clearSelections(panel.key)} searchPlaceholder={`Search ${panel.title.toLowerCase()}…`} maxHeightClassName="max-h-52" />

              ))}

            </div>

            <div className="lis-referral-date-criteria">

              <ReportDateRange fromId="rc-from-date" toId="rc-to-date" fromValue={filters.fromDate} toValue={filters.toDate}

                onFromChange={(value) => setFilter("fromDate", value)} onToChange={(value) => setFilter("toDate", value)} />

              <ReportSearchInput id="rc-patient-id" label="Patient ID" value={filters.patientId} onChange={(value) => setFilter("patientId", value)} />

              <fieldset className="lis-referral-radio-line"><legend className="sr-only">Commission Basis</legend>

                <label><input type="radio" name="rc-commission-basis" checked={filters.commissionBasis === "referral"} onChange={() => setFilter("commissionBasis", "referral")} /> Referral Dr Wise</label>

                <label><input type="radio" name="rc-commission-basis" checked={filters.commissionBasis === "cons_op_ip"} onChange={() => setFilter("commissionBasis", "cons_op_ip")} /> Only OP/IP Cons. Dr Wise</label>

              </fieldset>

              <fieldset className="lis-referral-radio-line"><legend>Patient Type</legend>

                {COMMISSION_PATIENT_TYPE_OPTIONS.map((option) => <label key={option.value}><input type="checkbox" checked={filters.patientTypes.includes(option.value)} onChange={() => toggleSelection("patientTypes", option.value)} />{option.label}</label>)}

              </fieldset>

              <ReportSelect id="rc-claim-type" label="Claim Type" value={filters.claimType} onChange={(value) => setFilter("claimType", value)} options={COMMISSION_CLAIM_TYPE_OPTIONS} />

            </div>

            <fieldset className="lis-referral-amount-basis lis-referral-radio-line"><legend className="sr-only">Amount Basis</legend>

              <label><input type="radio" name="rc-amount-basis" checked={filters.amountBasis === "net"} onChange={() => setFilter("amountBasis", "net")} /> % on Net Amount</label>

              <label><input type="radio" name="rc-amount-basis" checked={filters.amountBasis === "paid"} onChange={() => setFilter("amountBasis", "paid")} /> % on Paid Amount</label>

            </fieldset>

          </div>

        </ReportFilterBar>



        <ReportSummary items={summaryItems} />



        {(result || loading || error) && <ReportPreview reportTitle="Lab - Dr Referral - Bill wise" criteria={criteriaText} total={result?.pagination.total ?? 0} className="lis-tmis-document">

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

                  emptyMessage="No bill records found. Adjust the filters and search again."

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

        </ReportPreview>}

      </div>



      <ReportPrintSheet

        rows={printRows}

        columns={printColumns}

        title="Lab - Dr Referral - Bill wise"

        subtitle="Referral Doctor Commission Report"

        criteria={criteriaText}

        generatedAt={new Date().toISOString()}

        summaryNote={

          result

            ? `Total Bills : ${result.summary.totalBills}  ·  Bill Net : ${formatMoney(

                result.summary.totalNet,

              )}  ·  Bill Paid : ${formatMoney(

                result.summary.totalPaid,

              )}  ·  Total Commission : ${formatMoney(

                result.summary.totalCommission,

              )}  ·  Missing Config : ${result.summary.missingConfigs}`

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

          formatMoney(result?.summary.totalNet ?? 0),

          formatMoney(result?.summary.totalPaid ?? 0),

          "",

          formatMoney(result?.summary.totalCommission ?? 0),

        ]}

      />

    </>

  );

}