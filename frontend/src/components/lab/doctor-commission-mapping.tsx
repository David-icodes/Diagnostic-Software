"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Handshake } from "lucide-react";
import { ConfirmDialog } from "@/components/database/confirm-dialog";
import { DataTable } from "@/components/database/data-table";
import { FormField } from "@/components/database/form-field";
import { FormSection } from "@/components/database/form-section";
import { PageHeader } from "@/components/database/page-header";
import { LabActions } from "@/components/lab/lab-actions";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { fetchDepartments, fetchDoctors } from "@/services/billing";
import {
  assignCommissionMappings,
  fetchCommissionMappings,
} from "@/services/lab-masters";
import type { CommissionMappingRow } from "@/types/lab-masters";
import { cn, formatMoney } from "@/lib/utils";

import { resolveCommissionDraft } from "@/lib/commission-draft";

interface CommissionDraft {
  percent: string;
  amount: string;
}

export function DoctorCommissionMappingContent() {
  const queryClient = useQueryClient();
  const [testSearch, setTestSearch] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [doctorSearch, setDoctorSearch] = useState("");
  const [departmentSearch, setDepartmentSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, CommissionDraft>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [copyMode, setCopyMode] = useState(false);
  const [copyDoctorIds, setCopyDoctorIds] = useState<string[]>([]);
  const [copyConfirmOpen, setCopyConfirmOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [notice, setNotice] = useState<{
    kind: "success" | "warn" | "error";
    text: string;
  } | null>(null);

  const doctorsQuery = useQuery({
    queryKey: ["doctors", "lab-master"],
    queryFn: () => fetchDoctors({ limit: 500, status: "active" }),
  });

  const departmentsQuery = useQuery({
    queryKey: ["departments", "lab-master"],
    queryFn: () =>
      fetchDepartments({ status: "active" }).then((rows) =>
        rows
          .filter((row) => row.active !== false)
          .sort((a, b) => a.name.localeCompare(b.name)),
      ),
  });

  const enabled = doctorId.length > 0 && departmentId.length > 0;

  const mappingsQuery = useQuery({
    queryKey: ["commission-mappings", { doctorId, departmentId }],
    queryFn: () => fetchCommissionMappings(doctorId, departmentId),
    enabled,
  });

  const saveMutation = useMutation({
    mutationFn: (overwriteExisting: boolean) => {
      const rows = (mappingsQuery.data ?? [])
        .filter((row) => selected[row.testId])
        .map((row) => {
          return { testId: row.testId, ...resolveCommissionDraft(row, drafts[row.testId]) };
        });
      return assignCommissionMappings(doctorId, departmentId, rows, overwriteExisting);
    },
    onSuccess: (result) => {
      setSelected({});
      setDrafts({});
      void queryClient.invalidateQueries({
        queryKey: ["commission-mappings", { doctorId, departmentId }],
      });
      showNotice(
        "success",
        `Commission assigned to ${result.assigned} test(s)${result.removed > 0 ? `, removed ${result.removed}` : ""}`,
      );
    },
    onError: (error) => {
      showNotice(
        "error",
        error instanceof Error
          ? error.message
          : "Failed to assign commission",
      );
    },
  });

  const copyMutation = useMutation({
    mutationFn: async () => {
      const mappings = (mappingsQuery.data ?? []).filter((row) => selected[row.testId]).map((row) => ({ testId: row.testId, ...resolveCommissionDraft(row, drafts[row.testId]) }));
      let copied = 0;
      for (const targetId of copyDoctorIds) {
        try {
          await assignCommissionMappings(targetId, departmentId, mappings, true);
          copied += 1;
        } catch (error) {
          throw new Error(`Copied to ${copied} doctor(s). ${error instanceof Error ? error.message : "Copy failed"}`);
        }
      }
      return copied;
    },
    onSuccess: (copied) => {
      setCopyMode(false);
      setCopyDoctorIds([]);
      void queryClient.invalidateQueries({ queryKey: ["commission-mappings"] });
      showNotice("success", `Commission set copied to ${copied} doctor(s)`);
    },
    onError: (error) => showNotice("error", error instanceof Error ? error.message : "Copy failed"),
  });

  const busy = saveMutation.isPending || copyMutation.isPending;

  const showNotice = (kind: "success" | "warn" | "error", text: string) => {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), 3500);
  };

  const doctors = (doctorsQuery.data ?? []).filter((doctor) => doctor.active !== false);
  const departments = departmentsQuery.data ?? [];
  const rows = mappingsQuery.data ?? [];

  const selectedCount = useMemo(
    () => Object.values(selected).filter(Boolean).length,
    [selected],
  );

  const visibleRows = rows.filter((row) => row.testName.toLowerCase().includes(testSearch.toLowerCase()));
  const allSelected = visibleRows.length > 0 && visibleRows.every((row) => selected[row.testId]);

  const toggleAll = (checked: boolean) => {
    const next = { ...selected };
    for (const row of visibleRows) next[row.testId] = checked;
    setSelected(next);
  };

  const updateDraft = (testId: string, patch: Partial<CommissionDraft>) => {
    setDrafts((current) => ({
      ...current,
      [testId]: { ...current[testId], ...patch },
    }));
  };

  const handleSubmit = () => {
    if (!enabled) return;
    if (selectedCount === 0) {
      showNotice("warn", "Select at least one test to assign commission");
      return;
    }
    if (rows.some((row) => selected[row.testId] && (row.commissionPercent !== undefined || row.commissionAmount !== undefined))) {
      setConfirmOpen(true);
    } else {
      saveMutation.mutate(false);
    }
  };

  const handleClear = () => {
    setSelected({});
    setDrafts({});
    setCopyMode(false);
    setCopyDoctorIds([]);
    setNotice(null);
  };

  const columns = useMemo(
    () => [
      {
        key: "select",
        header: "Select",
        align: "center" as const,
        className: "w-16",
        render: (row: CommissionMappingRow) => (
          <Checkbox
            aria-label={`Select ${row.testName}`}
            checked={selected[row.testId] ?? false}
            onChange={(event) =>
              setSelected((current) => ({
                ...current,
                [row.testId]: event.target.checked,
              }))
            }
            disabled={busy}
          />
        ),
      },
      {
        key: "sno",
        header: "S.No",
        align: "center" as const,
        className: "w-14",
        render: (_row: CommissionMappingRow, index: number) => index + 1,
      },
      {
        key: "testName",
        header: "Test Name",
        render: (row: CommissionMappingRow) => (
          <span className="font-medium text-slate-800">{row.testName}</span>
        ),
      },
      {
        key: "amount",
        header: "Test Price (OP)",
        align: "right" as const,
        render: (row: CommissionMappingRow) => (
          <span className="font-medium text-slate-800">{formatMoney(row.amount)}</span>
        ),
      },
      {
        key: "percent",
        header: "Commission %",
        align: "right" as const,
        render: (row: CommissionMappingRow) => (
          <div className="flex justify-end">
            <Input
              type="number"
              min={0}
              step="0.01"
              className="h-7 w-20 text-right"
              value={drafts[row.testId]?.percent ?? (row.commissionPercent !== undefined ? String(row.commissionPercent) : "")}
              placeholder="0"
              onChange={(event) =>
                updateDraft(row.testId, { percent: event.target.value })
              }
              disabled={busy}
            />
          </div>
        ),
      },
      {
        key: "amountEntry",
        header: "Commission Amount",
        align: "right" as const,
        render: (row: CommissionMappingRow) => (
          <div className="flex justify-end">
            <Input
              type="number"
              min={0}
              step="0.01"
              className="h-7 w-24 text-right"
              value={drafts[row.testId]?.amount ?? (row.commissionAmount !== undefined ? String(row.commissionAmount) : "")}
              placeholder="0.00"
              onChange={(event) =>
                updateDraft(row.testId, { amount: event.target.value })
              }
              disabled={busy}
            />
          </div>
        ),
      },
    ],
    [selected, drafts, busy],
  );

  return (
    <div className="lis-dm lis-commission space-y-3">
      <PageHeader
        icon={Handshake}
        title="Doctor Lab Test Commission Mapping"
        subtitle="Assign referral commission by doctor and department"
      />

      <FormSection
        title="Select Doctor & Department"
        description="Choose a doctor and department to configure its test commission"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:max-w-3xl">
          <FormField id="comm-doctor" label="Select Doctor" required>
            <div className="lis-master-listbox">
            <Input aria-label="Search doctors" placeholder="Search Doctor..." value={doctorSearch} onChange={(event) => setDoctorSearch(event.target.value)} />
            <Select
              id="comm-doctor"
              disabled={busy}
              size={10}
              className="h-8"
              value={doctorId}
              onChange={(event) => {
                setDoctorId(event.target.value);
                setSelected({});
                setDrafts({});
                setCopyMode(false);
                setCopyDoctorIds([]);
                setNotice(null);
              }}
            >
              <option value="">--Select--</option>
              {doctors.filter((doctor) => doctor.id === doctorId || doctor.name.toLowerCase().includes(doctorSearch.toLowerCase())).map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.name}
                </option>
              ))}
            </Select>
            </div>
          </FormField>
          <FormField id="comm-dept" label="Select Department" required>
            <div className="lis-master-listbox">
            <Input aria-label="Search departments" placeholder="Search Department..." value={departmentSearch} onChange={(event) => setDepartmentSearch(event.target.value)} />
            <Select
              id="comm-dept"
              disabled={busy}
              size={10}
              className="h-8"
              value={departmentId}
              onChange={(event) => {
                setDepartmentId(event.target.value);
                setSelected({});
                setDrafts({});
                setCopyMode(false);
                setCopyDoctorIds([]);
                setNotice(null);
              }}
            >
              <option value="">--Select--</option>
              {departments.filter((department) => department.id === departmentId || department.name.toLowerCase().includes(departmentSearch.toLowerCase())).map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
            </div>
          </FormField>
        </div>
      </FormSection>

      <FormSection
        title="Commission Set"
        description={
          enabled
            ? "Enter percentage or fixed amount; amount takes precedence for a test"
            : "Select a doctor and department to load its tests"
        }
      >
        <div className="space-y-3">
          <div className="lis-dm-table-search"><Input aria-label="Search lab tests" placeholder="Search Lab Tests..." value={testSearch} onChange={(event) => setTestSearch(event.target.value)} /></div>
          {notice && (
            <p
              className={cn(
                "rounded-md px-3 py-2 text-xs font-medium ring-1",
                notice.kind === "success" &&
                  "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
                notice.kind === "warn" &&
                  "bg-amber-50 text-amber-700 ring-amber-600/20",
                notice.kind === "error" &&
                  "bg-destructive/5 text-destructive ring-destructive/20",
              )}
            >
              {notice.text}
            </p>
          )}

          {enabled ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                  <Checkbox aria-label="Select All" disabled={busy || visibleRows.length === 0} checked={allSelected} onChange={(event) => toggleAll(event.target.checked)} />
                  Select All
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                  <Checkbox
                    checked={copyMode}
                    disabled={busy || selectedCount === 0}
                    onChange={(event) => { setCopyMode(event.target.checked); setCopyDoctorIds([]); }}
                  />
                  Copy The Above Tariff Set
                </label>
              </div>
              <DataTable
                data={visibleRows}
                rowKey={(row) => row.testId}
                loading={mappingsQuery.isLoading}
                emptyMessage="No tests found in this department"
                columns={columns}
              />

            </>
          ) : (
            <DataTable data={[]} rowKey={(row) => row.testId} columns={columns} emptyMessage="Select a doctor and department to load its commission set" />
          )}
        </div>
      </FormSection>

      {copyMode && (
        <FormSection title="Select Doctors">
          <label className="flex items-center gap-2 text-xs">
            <Checkbox disabled={busy} aria-label="Select all destination doctors" checked={doctors.length > 0 && doctors.every((doctor) => copyDoctorIds.includes(doctor.id))} onChange={(event) => setCopyDoctorIds(event.target.checked ? doctors.map((doctor) => doctor.id) : [])} />All
          </label>
          <div className="lis-commission-copy-doctors">
            {doctors.map((doctor) => <label key={doctor.id} className="flex items-center gap-2 text-xs"><Checkbox disabled={busy} aria-label={`Copy to ${doctor.name}`} checked={copyDoctorIds.includes(doctor.id)} onChange={(event) => setCopyDoctorIds((ids) => event.target.checked ? [...ids, doctor.id] : ids.filter((id) => id !== doctor.id))} />{doctor.name}</label>)}
          </div>
          <button type="button" className="lis-commission-copy-button" disabled={busy} onClick={() => { if (selectedCount === 0 || copyDoctorIds.length === 0) showNotice("warn", "Select tests and destination doctors to copy"); else setCopyConfirmOpen(true); }}>Copy</button>
        </FormSection>
      )}
      <ConfirmDialog open={copyConfirmOpen} onOpenChange={setCopyConfirmOpen} title="Copy commission set?" description={`Copy ${selectedCount} selected test(s) to ${copyDoctorIds.length} doctor(s)? Existing values for these selected tests will be updated.`} confirmLabel="Copy" loading={copyMutation.isPending} onConfirm={() => { setCopyConfirmOpen(false); copyMutation.mutate(); }} />

      <LabActions
        disabled={!enabled}
        onSubmit={copyMode ? undefined : handleSubmit}
        onClear={handleClear}
        submitting={busy}
        submitLabel="Submit"
        homeHref="/dashboard"
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open) setConfirmOpen(false);
        }}
        title="Update existing commissions?"
        description="The selected tests already have a commission mapping. Continue will overwrite the existing commission for the selected tests."
        confirmLabel="Yes, Overwrite"
        loading={saveMutation.isPending}
        onConfirm={() => {
          setConfirmOpen(false);
          saveMutation.mutate(true);
        }}
      />
    </div>
  );
}
