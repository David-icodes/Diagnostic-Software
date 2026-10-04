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

interface CommissionDraft {
  percent: string;
  amount: string;
}

function toNum(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function DoctorCommissionMappingContent() {
  const queryClient = useQueryClient();
  const [doctorId, setDoctorId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, CommissionDraft>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [overwrite, setOverwrite] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [notice, setNotice] = useState<{
    kind: "success" | "warn" | "error";
    text: string;
  } | null>(null);

  const doctorsQuery = useQuery({
    queryKey: ["doctors", "lab-master"],
    queryFn: () => fetchDoctors({ limit: 100, status: "active" }),
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
    mutationFn: () => {
      const rows = (mappingsQuery.data ?? [])
        .filter((row) => selected[row.testId])
        .map((row) => {
          const draft = drafts[row.testId];
          return {
            testId: row.testId,
            commissionPercent: toNum(draft?.percent),
            commissionAmount: toNum(draft?.amount),
          };
        });
      return assignCommissionMappings(doctorId, departmentId, rows, overwrite);
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
          ? `${error.message}${overwrite ? "" : " Please tick the \"Copy The Above Tariff Set\" box to overwrite."}`
          : "Failed to assign commission",
      );
    },
  });

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

  const allSelected = rows.length > 0 && rows.every((row) => selected[row.testId]);

  const toggleAll = (checked: boolean) => {
    const next: Record<string, boolean> = {};
    for (const row of rows) next[row.testId] = checked;
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
    if (overwrite) {
      setConfirmOpen(true);
    } else {
      void saveMutation.mutateAsync();
    }
  };

  const handleClear = () => {
    setSelected({});
    setDrafts({});
    setOverwrite(false);
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
            disabled={saveMutation.isPending}
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
              disabled={saveMutation.isPending}
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
              disabled={saveMutation.isPending}
            />
          </div>
        ),
      },
    ],
    [selected, drafts, saveMutation.isPending],
  );

  return (
    <div className="space-y-3">
      <PageHeader
        icon={Handshake}
        title="Dr & Dept Wise Commission Mapping"
        subtitle="Assign referral commission by doctor and department"
      />

      <FormSection
        title="Select Doctor & Department"
        description="Choose a doctor and department to configure its test commission"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:max-w-3xl">
          <FormField id="comm-doctor" label="Select Doctor" required>
            <Select
              id="comm-doctor"
              className="h-8"
              value={doctorId}
              onChange={(event) => {
                setDoctorId(event.target.value);
                setSelected({});
                setDrafts({});
                setOverwrite(false);
                setNotice(null);
              }}
            >
              <option value="">--Select--</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="comm-dept" label="Select Department" required>
            <Select
              id="comm-dept"
              className="h-8"
              value={departmentId}
              onChange={(event) => {
                setDepartmentId(event.target.value);
                setSelected({});
                setDrafts({});
                setOverwrite(false);
                setNotice(null);
              }}
            >
              <option value="">--Select--</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
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
                  <Checkbox checked={allSelected} onChange={(event) => toggleAll(event.target.checked)} />
                  Select All
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                  <Checkbox
                    checked={overwrite}
                    onChange={(event) => setOverwrite(event.target.checked)}
                  />
                  Copy The Above Tariff Set
                </label>
              </div>
              <DataTable
                data={rows}
                rowKey={(row) => row.testId}
                loading={mappingsQuery.isLoading}
                emptyMessage="No tests found in this department"
                columns={columns}
              />
              <LabActions
                onSubmit={handleSubmit}
                onClear={handleClear}
                submitting={saveMutation.isPending}
                submitLabel="Submit"
                homeHref="/laboratory"
              />
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-border px-3 py-5 text-center text-sm text-muted-foreground">
              Select a doctor and department to load its commission set
            </div>
          )}
        </div>
      </FormSection>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open) setConfirmOpen(false);
        }}
        title="Copy The Above Tariff Set?"
        description="The selected tests already have a commission mapping. Continue will overwrite the existing commission for the selected tests."
        confirmLabel="Yes, Overwrite"
        loading={saveMutation.isPending}
        onConfirm={() => {
          setConfirmOpen(false);
          void saveMutation.mutateAsync();
        }}
      />
    </div>
  );
}