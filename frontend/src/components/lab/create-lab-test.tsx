"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, FlaskConical, Pencil, Power } from "lucide-react";
import { AddableDatalist } from "@/components/common/addable-datalist";
import { ConfirmDialog } from "@/components/database/confirm-dialog";
import { DataTable } from "@/components/database/data-table";
import { FormField } from "@/components/database/form-field";
import { FormSection } from "@/components/database/form-section";
import { PageHeader } from "@/components/database/page-header";
import { SearchInput } from "@/components/database/search-input";
import { StatusBadge } from "@/components/database/status-badge";
import { LabActions } from "@/components/lab/lab-actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { fetchDepartments } from "@/services/billing";
import {
  createLabMasterTest,
  fetchLabMasterTests,
  fetchSpecimenOptions,
  setLabTestActive,
  updateLabMasterTest,
} from "@/services/lab-masters";
import type { LabTestRow } from "@/types/lab-masters";
import { formatMoney } from "@/lib/utils";

const PAGE_LIMIT = 20;

const RESULT_MODE_OPTIONS = [
  { value: "PARAMETER_BASED", label: "Parameter Based" },
  { value: "TEMPLATE_BASED", label: "Template Based" },
  { value: "SIMPLE_RESULT", label: "Simple Result" },
  { value: "CALCULATED", label: "Calculated" },
];

interface TestFormState {
  departmentId: string;
  testCode: string;
  testName: string;
  shortName: string;
  testType: string;
  price: string;
  priceIp: string;
  priceInsIp: string;
  priceEr: string;
  doctorPrice: string;
  referralPercent: string;
  resultMode: string;
  active: boolean;
  cghsCode: string;
  nimsCode: string;
  railwayCode: string;
  nfcCode: string;
  sampleType: string;
  containerType: string;
  description: string;
  reportNote1: string;
  reportNote2: string;
  comments: string;
}

const EMPTY_FORM: TestFormState = {
  departmentId: "",
  testCode: "",
  testName: "",
  shortName: "",
  testType: "",
  price: "",
  priceIp: "",
  priceInsIp: "",
  priceEr: "",
  doctorPrice: "",
  referralPercent: "",
  resultMode: "PARAMETER_BASED",
  active: true,
  cghsCode: "",
  nimsCode: "",
  railwayCode: "",
  nfcCode: "",
  sampleType: "",
  containerType: "",
  description: "",
  reportNote1: "",
  reportNote2: "",
  comments: "",
};

function toNum(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function CreateLabTestContent() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<TestFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [page, setPage] = useState(1);
  const [confirmTarget, setConfirmTarget] = useState<LabTestRow | null>(null);
  const [viewTarget, setViewTarget] = useState<LabTestRow | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const departmentsQuery = useQuery({
    queryKey: ["departments", "lab-master"],
    queryFn: () =>
      fetchDepartments({ status: "active" }).then((rows) =>
        rows
          .filter((row) => row.active !== false)
          .sort((a, b) => a.name.localeCompare(b.name)),
      ),
  });

  const specimenQuery = useQuery({
    queryKey: ["lab-tests", "specimen-options"],
    queryFn: fetchSpecimenOptions,
  });

  const listQuery = useQuery({
    queryKey: [
      "lab-tests",
      "master",
      { page, search, statusFilter, departmentFilter },
    ],
    queryFn: () =>
      fetchLabMasterTests({
        page,
        limit: PAGE_LIMIT,
        search: search || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        departmentId: departmentFilter || undefined,
      }),
    placeholderData: (previous) => previous,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["lab-tests", "master"] });
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        departmentId: form.departmentId,
        testCode: form.testCode.trim().toUpperCase(),
        testName: form.testName.trim(),
        shortName: form.shortName.trim(),
        testType: form.testType.trim() || undefined,
        sampleType: form.sampleType.trim() || undefined,
        containerType: form.containerType.trim() || undefined,
        description: form.description.trim() || undefined,
        reportNote1: form.reportNote1.trim() || undefined,
        reportNote2: form.reportNote2.trim() || undefined,
        comments: form.comments.trim() || undefined,
        resultMode: form.resultMode as LabTestRow["resultMode"],
        active: form.active,
        price: toNum(form.price) ?? 0,
        priceIp: toNum(form.priceIp),
        priceInsIp: toNum(form.priceInsIp),
        priceEr: toNum(form.priceEr),
        doctorPrice: toNum(form.doctorPrice),
        referralPercent: toNum(form.referralPercent),
        cghsCode: form.cghsCode.trim() || undefined,
        nimsCode: form.nimsCode.trim() || undefined,
        railwayCode: form.railwayCode.trim() || undefined,
        nfcCode: form.nfcCode.trim() || undefined,
      };
      return editingId
        ? updateLabMasterTest(editingId, payload)
        : createLabMasterTest(payload);
    },
    onSuccess: () => {
      invalidate();
      setEditingId(null);
      setForm(EMPTY_FORM);
      setFeedback(
        editingId
          ? "Lab test updated successfully"
          : "Lab test created successfully",
      );
      window.setTimeout(() => setFeedback(null), 2500);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      setLabTestActive(id, active),
    onSuccess: () => {
      invalidate();
      setConfirmTarget(null);
    },
  });

  const update = (patch: Partial<TestFormState>) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const clearForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFeedback(null);
  };

  const handleSave = () => {
    if (
      !form.departmentId ||
      form.testCode.trim().length < 2 ||
      form.testName.trim().length < 3 ||
      form.shortName.trim().length < 1
    ) {
      return;
    }
    void saveMutation.mutateAsync();
  };

  const handleEdit = useCallback((test: LabTestRow) => {
    setEditingId(test.id);
    setForm({
      departmentId: test.departmentId,
      testCode: test.testCode,
      testName: test.testName,
      shortName: test.shortName ?? "",
      testType: test.testType ?? "",
      price: String(test.price ?? ""),
      priceIp: test.priceIp !== undefined ? String(test.priceIp) : "",
      priceInsIp: test.priceInsIp !== undefined ? String(test.priceInsIp) : "",
      priceEr: test.priceEr !== undefined ? String(test.priceEr) : "",
      doctorPrice: test.doctorPrice !== undefined ? String(test.doctorPrice) : "",
      referralPercent:
        test.referralPercent !== undefined ? String(test.referralPercent) : "",
      resultMode: test.resultMode,
      active: test.active,
      cghsCode: test.cghsCode ?? "",
      nimsCode: test.nimsCode ?? "",
      railwayCode: test.railwayCode ?? "",
      nfcCode: test.nfcCode ?? "",
      sampleType: test.sampleType ?? "",
      containerType: test.containerType ?? "",
      description: test.description ?? "",
      reportNote1: test.reportNote1 ?? "",
      reportNote2: test.reportNote2 ?? "",
      comments: test.comments ?? "",
    });
    setFeedback(null);
  }, []);

  const departments = departmentsQuery.data ?? [];
  const rows = listQuery.data?.items ?? [];
  const pagination = listQuery.data?.pagination;

  const columns = useMemo(
    () => [
      {
        key: "sno",
        header: "S.No",
        align: "center" as const,
        className: "w-14",
        render: (_row: LabTestRow, index: number) =>
          ((pagination?.page ?? 1) - 1) * PAGE_LIMIT + index + 1,
      },
      {
        key: "departmentName",
        header: "Dept Name",
        render: (row: LabTestRow) => (
          <span className="font-medium text-slate-800">{row.departmentName}</span>
        ),
      },
      {
        key: "testName",
        header: "Lab Test Name",
        render: (row: LabTestRow) => row.testName,
      },
      {
        key: "testCode",
        header: "Test Code",
        render: (row: LabTestRow) => row.testCode,
      },
      {
        key: "price",
        header: "OP Price",
        align: "right" as const,
        render: (row: LabTestRow) => (
          <span className="font-medium text-slate-800">{formatMoney(row.price)}</span>
        ),
      },
      {
        key: "status",
        header: "Status",
        align: "center" as const,
        render: (row: LabTestRow) => <StatusBadge active={row.active} />,
      },
      {
        key: "actions",
        header: "Action",
        align: "center" as const,
        className: "w-32",
        render: (row: LabTestRow) => (
          <div className="flex items-center justify-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`View ${row.testName}`}
              onClick={() => setViewTarget(row)}
            >
              <Eye className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Edit ${row.testName}`}
              onClick={() => handleEdit(row)}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={
                row.active ? `Deactivate ${row.testName}` : `Activate ${row.testName}`
              }
              onClick={() => setConfirmTarget(row)}
            >
              <Power className="size-4" />
            </Button>
          </div>
        ),
      },
    ],
    [pagination, handleEdit],
  );

  const saveError = saveMutation.error instanceof Error
    ? saveMutation.error.message
    : null;

  return (
    <div className="space-y-3">
      <PageHeader
        icon={FlaskConical}
        title="Create New Lab Test"
        subtitle="Add and manage lab tests, prices and result configuration"
      />

      <FormSection
        title={editingId ? "Update Lab Test" : "Add New Lab Test"}
        description={
          editingId ? "Update the details and save" : "Enter the details and save"
        }
      >
        <div className="space-y-3">
          {feedback && (
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/20">
              {feedback}
            </p>
          )}
          {saveError && (
            <p className="rounded-md bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive ring-1 ring-destructive/20">
              {saveError}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FormField id="test-dept" label="Department Name" required>
              <Select
                id="test-dept"
                className="h-8"
                value={form.departmentId}
                onChange={(event) => update({ departmentId: event.target.value })}
                disabled={saveMutation.isPending}
              >
                <option value="">--Select--</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField id="test-code" label="Test Code" required>
              <Input
                id="test-code"
                value={form.testCode}
                placeholder="e.g. BS001"
                maxLength={20}
                onChange={(event) =>
                  update({ testCode: event.target.value.toUpperCase() })
                }
                disabled={saveMutation.isPending}
              />
            </FormField>
            <FormField id="test-name" label="Test Name" required>
              <Input
                id="test-name"
                value={form.testName}
                placeholder="e.g. BLOOD SUGAR (F)"
                onChange={(event) => update({ testName: event.target.value })}
                disabled={saveMutation.isPending}
              />
            </FormField>
            <FormField id="test-short" label="Short Name" required>
              <Input
                id="test-short"
                value={form.shortName}
                placeholder="e.g. BS(F)"
                onChange={(event) => update({ shortName: event.target.value })}
                disabled={saveMutation.isPending}
              />
            </FormField>
            <FormField id="test-type" label="Test Type">
              <Input
                id="test-type"
                value={form.testType}
                placeholder="e.g. Biochemistry"
                onChange={(event) => update({ testType: event.target.value })}
                disabled={saveMutation.isPending}
              />
            </FormField>
            <FormField id="test-price" label="OP Price" required>
              <Input
                id="test-price"
                type="number"
                min={0}
                step="0.01"
                value={form.price}
                placeholder="0.00"
                onChange={(event) => update({ price: event.target.value })}
                disabled={saveMutation.isPending}
              />
            </FormField>
            <FormField id="test-price-ip" label="IP Price">
              <Input
                id="test-price-ip"
                type="number"
                min={0}
                step="0.01"
                value={form.priceIp}
                placeholder="0.00"
                onChange={(event) => update({ priceIp: event.target.value })}
                disabled={saveMutation.isPending}
              />
            </FormField>
            <FormField id="test-price-ins-ip" label="Ins IP Price">
              <Input
                id="test-price-ins-ip"
                type="number"
                min={0}
                step="0.01"
                value={form.priceInsIp}
                placeholder="0.00"
                onChange={(event) => update({ priceInsIp: event.target.value })}
                disabled={saveMutation.isPending}
              />
            </FormField>
            <FormField id="test-price-er" label="ER Price">
              <Input
                id="test-price-er"
                type="number"
                min={0}
                step="0.01"
                value={form.priceEr}
                placeholder="0.00"
                onChange={(event) => update({ priceEr: event.target.value })}
                disabled={saveMutation.isPending}
              />
            </FormField>
            <FormField id="test-doctor-price" label="Doctor Price">
              <Input
                id="test-doctor-price"
                type="number"
                min={0}
                step="0.01"
                value={form.doctorPrice}
                placeholder="0.00"
                onChange={(event) => update({ doctorPrice: event.target.value })}
                disabled={saveMutation.isPending}
              />
            </FormField>
            <FormField id="test-referral" label="Referral %">
              <Input
                id="test-referral"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={form.referralPercent}
                placeholder="0"
                onChange={(event) => update({ referralPercent: event.target.value })}
                disabled={saveMutation.isPending}
              />
            </FormField>
            <FormField id="test-result-mode" label="Result Type">
              <Select
                id="test-result-mode"
                className="h-8"
                value={form.resultMode}
                onChange={(event) => update({ resultMode: event.target.value })}
                disabled={saveMutation.isPending}
              >
                {RESULT_MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField id="test-active" label="Active Status">
              <label
                htmlFor="test-active"
                className="flex h-8 items-center gap-2 text-sm text-slate-700"
              >
                <Checkbox
                  id="test-active"
                  checked={form.active}
                  onChange={(event) => update({ active: event.target.checked })}
                  disabled={saveMutation.isPending}
                />
                {form.active ? "Active" : "Inactive"}
              </label>
            </FormField>
            <FormField id="test-cghs" label="CGHS Code">
              <Input
                id="test-cghs"
                value={form.cghsCode}
                placeholder="Optional"
                onChange={(event) => update({ cghsCode: event.target.value })}
                disabled={saveMutation.isPending}
              />
            </FormField>
            <FormField id="test-nims" label="NIMS Code">
              <Input
                id="test-nims"
                value={form.nimsCode}
                placeholder="Optional"
                onChange={(event) => update({ nimsCode: event.target.value })}
                disabled={saveMutation.isPending}
              />
            </FormField>
            <FormField id="test-railway" label="Railway Code">
              <Input
                id="test-railway"
                value={form.railwayCode}
                placeholder="Optional"
                onChange={(event) => update({ railwayCode: event.target.value })}
                disabled={saveMutation.isPending}
              />
            </FormField>
            <FormField id="test-nfc" label="NFC Code">
              <Input
                id="test-nfc"
                value={form.nfcCode}
                placeholder="Optional"
                onChange={(event) => update({ nfcCode: event.target.value })}
                disabled={saveMutation.isPending}
              />
            </FormField>
            <FormField id="test-sample" label="Sample Name">
              <AddableDatalist
                id="test-sample"
                value={form.sampleType}
                onChange={(value) => update({ sampleType: value })}
                options={specimenQuery.data?.sampleTypes ?? []}
                placeholder="e.g. Blood / Serum"
              />
            </FormField>
            <FormField id="test-container" label="Tube Container">
              <AddableDatalist
                id="test-container"
                value={form.containerType}
                onChange={(value) => update({ containerType: value })}
                options={specimenQuery.data?.containerTypes ?? []}
                placeholder="e.g. Plain / EDTA"
              />
            </FormField>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField id="test-desc" label="Description">
              <Input
                id="test-desc"
                value={form.description}
                placeholder="Optional notes"
                onChange={(event) => update({ description: event.target.value })}
                disabled={saveMutation.isPending}
              />
            </FormField>
            <FormField id="test-note-1" label="Report Note 1">
              <Input
                id="test-note-1"
                value={form.reportNote1}
                placeholder="Optional report note"
                onChange={(event) => update({ reportNote1: event.target.value })}
                disabled={saveMutation.isPending}
              />
            </FormField>
            <FormField id="test-note-2" label="Report Note 2">
              <Input
                id="test-note-2"
                value={form.reportNote2}
                placeholder="Optional report note"
                onChange={(event) => update({ reportNote2: event.target.value })}
                disabled={saveMutation.isPending}
              />
            </FormField>
            <FormField id="test-comments" label="Comments">
              <Input
                id="test-comments"
                value={form.comments}
                placeholder="Optional comments"
                onChange={(event) => update({ comments: event.target.value })}
                disabled={saveMutation.isPending}
              />
            </FormField>
          </div>
          <LabActions
            onSubmit={handleSave}
            onClear={clearForm}
            submitting={saveMutation.isPending}
            submitLabel={editingId ? "Update" : "Submit"}
            homeHref="/laboratory"
          />
        </div>
      </FormSection>

      <FormSection
        title="List of Lab Tests"
        description="Configured tests with their prices"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="Filter by department"
              className="h-8 w-44"
              value={departmentFilter}
              onChange={(event) => {
                setDepartmentFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All Departments</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Filter by status"
              className="h-8 w-32"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
            <SearchInput
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              placeholder="Search tests..."
            />
          </div>
        }
      >
        <DataTable
          data={rows}
          rowKey={(row) => row.id}
          loading={listQuery.isLoading}
          emptyMessage="No lab tests found"
          highlightId={editingId ?? undefined}
          pagination={
            pagination
              ? {
                  page: pagination.page,
                  totalPages: pagination.totalPages,
                  total: pagination.total,
                  limit: pagination.limit,
                }
              : undefined
          }
          onPageChange={(target) => {
            setPage(target);
            window.scrollTo({ top: 0 });
          }}
          columns={columns}
        />
      </FormSection>

      <ConfirmDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null);
        }}
        title={confirmTarget?.active ? "Deactivate lab test?" : "Activate lab test?"}
        description={
          confirmTarget
            ? `Do you want to ${confirmTarget.active ? "deactivate" : "activate"} "${confirmTarget.testName}"?`
            : undefined
        }
        confirmLabel={confirmTarget?.active ? "Deactivate" : "Activate"}
        loading={toggleMutation.isPending}
        onConfirm={() => {
          if (confirmTarget) {
            void toggleMutation.mutate({
              id: confirmTarget.id,
              active: !confirmTarget.active,
            });
            setConfirmTarget(null);
          }
        }}
      />

      <Dialog
        open={viewTarget !== null}
        onOpenChange={(open) => {
          if (!open) setViewTarget(null);
        }}
        title="Lab Test Details"
        description={viewTarget ? viewTarget.testName : undefined}
        size="lg"
      >
        {viewTarget && (
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <DetailRow label="Department" value={viewTarget.departmentName} />
            <DetailRow label="Test Code" value={viewTarget.testCode} />
            <DetailRow label="Short Name" value={viewTarget.shortName ?? "—"} />
            <DetailRow label="Test Type" value={viewTarget.testType ?? "—"} />
            <DetailRow label="OP Price" value={formatMoney(viewTarget.price)} />
            <DetailRow
              label="IP Price"
              value={viewTarget.priceIp !== undefined ? formatMoney(viewTarget.priceIp) : "—"}
            />
            <DetailRow
              label="Ins IP Price"
              value={viewTarget.priceInsIp !== undefined ? formatMoney(viewTarget.priceInsIp) : "—"}
            />
            <DetailRow
              label="ER Price"
              value={viewTarget.priceEr !== undefined ? formatMoney(viewTarget.priceEr) : "—"}
            />
            <DetailRow
              label="Doctor Price"
              value={viewTarget.doctorPrice !== undefined ? formatMoney(viewTarget.doctorPrice) : "—"}
            />
            <DetailRow
              label="Referral %"
              value={viewTarget.referralPercent !== undefined ? String(viewTarget.referralPercent) : "—"}
            />
            <DetailRow label="Sample Name" value={viewTarget.sampleType ?? "—"} />
            <DetailRow
              label="Tube Container"
              value={viewTarget.containerType ?? "—"}
            />
            <DetailRow
              label="CGHS / NIMS"
              value={`${viewTarget.cghsCode ?? "—"} / ${viewTarget.nimsCode ?? "—"}`}
            />
            <DetailRow
              label="Railway / NFC"
              value={`${viewTarget.railwayCode ?? "—"} / ${viewTarget.nfcCode ?? "—"}`}
            />
            <DetailRow label="Result Type" value={viewTarget.resultMode} />
            <DetailRow label="Status" value={viewTarget.active ? "Active" : "Inactive"} />
            <DetailRow label="Description" value={viewTarget.description ?? "—"} />
            <DetailRow label="Report Notes" value={`${viewTarget.reportNote1 ?? ""} ${viewTarget.reportNote2 ?? ""}`.trim() || "—"} />
            <DetailRow label="Comments" value={viewTarget.comments ?? "—"} />
          </div>
        )}
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 py-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="font-medium text-slate-800">{value}</span>
    </div>
  );
}