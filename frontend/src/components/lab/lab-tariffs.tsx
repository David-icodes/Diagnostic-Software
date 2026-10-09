"use client";

import { useMemo, useState } from "react";
import { invalidateMasterData } from "@/lib/master-data-cache";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Percent } from "lucide-react";
import { DataTable } from "@/components/database/data-table";
import { FormField } from "@/components/database/form-field";
import { FormSection } from "@/components/database/form-section";
import { PageHeader } from "@/components/database/page-header";
import { LabActions } from "@/components/lab/lab-actions";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { fetchDepartments } from "@/services/billing";
import { fetchLabTariffs, updateLabTariffs } from "@/services/lab-masters";
import type { TariffRow } from "@/types/lab-masters";
import { cn } from "@/lib/utils";

const PAGE_LIMIT = 50;

interface TariffDraft {
  price?: string;
  priceIp?: string;
  priceInsIp?: string;
  priceEr?: string;
}

function toNum(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function DraftInput({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Input
      type="number"
      min={0}
      step="0.01"
      className="h-7 w-24 text-right"
      value={value}
      placeholder="—"
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
    />
  );
}

export function LabTariffsContent() {
  const queryClient = useQueryClient();
  const [departmentId, setDepartmentId] = useState("");
  const [page, setPage] = useState(1);
  const [drafts, setDrafts] = useState<Record<string, TariffDraft>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<{
    kind: "success" | "warn" | "error";
    text: string;
  } | null>(null);

  const departmentsQuery = useQuery({
    queryKey: ["departments", "lab-master"],
    queryFn: () =>
      fetchDepartments({ status: "active" }).then((rows) =>
        rows
          .filter((row) => row.active !== false)
          .sort((a, b) => a.name.localeCompare(b.name)),
      ),
  });

  const listQuery = useQuery({
    queryKey: ["lab-tariffs", { departmentId, page }],
    queryFn: () => fetchLabTariffs({ departmentId, page, limit: PAGE_LIMIT }),
    enabled: departmentId.length > 0,
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const rows = (listQuery.data?.data ?? [])
        .filter((row) => selected[row.testId])
        .map((row) => {
          const draft = drafts[row.testId];
          return {
            testId: row.testId,
            price: toNum(draft?.price) ?? row.price,
            priceIp:
              draft?.priceIp !== undefined ? toNum(draft.priceIp) : row.priceIp,
            priceInsIp:
              draft?.priceInsIp !== undefined
                ? toNum(draft.priceInsIp)
                : row.priceInsIp,
            priceEr:
              draft?.priceEr !== undefined ? toNum(draft.priceEr) : row.priceEr,
          };
        });
      return updateLabTariffs(rows);
    },
    onSuccess: (result) => {
      setSelected({});
      setDrafts({});
      void invalidateMasterData(queryClient, "lab-tariffs");
      showNotice("success", `Tariffs updated for ${result.updated} test(s)`);
    },
    onError: (error) => {
      showNotice(
        "error",
        error instanceof Error ? error.message : "Failed to update tariffs",
      );
    },
  });

  const showNotice = (
    kind: "success" | "warn" | "error",
    text: string,
  ) => {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), 3000);
  };

  const departments = departmentsQuery.data ?? [];
  const rows = listQuery.data?.data ?? [];
  const pagination = listQuery.data?.pagination;

  const selectedCount = useMemo(
    () => Object.values(selected).filter(Boolean).length,
    [selected],
  );

  const allOnPageSelected =
    rows.length > 0 && rows.every((row) => selected[row.testId]);

  const toggleAll = (checked: boolean) => {
    const next: Record<string, boolean> = {};
    for (const row of rows) next[row.testId] = checked;
    setSelected(next);
  };

  const updateDraft = (testId: string, patch: Partial<TariffDraft>) => {
    setDrafts((current) => ({
      ...current,
      [testId]: { ...current[testId], ...patch },
    }));
  };

  const baseline = (row: TariffRow, field: keyof TariffDraft): string => {
    if (field === "price") return String(row.price);
    if (field === "priceIp") return row.priceIp !== undefined ? String(row.priceIp) : "";
    if (field === "priceInsIp")
      return row.priceInsIp !== undefined ? String(row.priceInsIp) : "";
    return row.priceEr !== undefined ? String(row.priceEr) : "";
  };

  const handleSubmit = () => {
    if (selectedCount === 0) {
      showNotice("warn", "Select at least one test to update tariffs");
      return;
    }
    saveMutation.mutate();
  };

  const handleClear = () => {
    setSelected({});
    setDrafts({});
    setNotice(null);
  };

  const columns = useMemo(
    () => [
      {
        key: "select",
        header: "Select",
        align: "center" as const,
        className: "w-16",
        render: (row: TariffRow) => (
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
        render: (_row: TariffRow, index: number) =>
          ((pagination?.page ?? 1) - 1) * PAGE_LIMIT + index + 1,
      },
      {
        key: "departmentName",
        header: "Dept Name",
        render: (row: TariffRow) => (
          <span className="font-medium text-slate-800">{row.departmentName}</span>
        ),
      },
      {
        key: "testName",
        header: "Test Name",
        render: (row: TariffRow) => row.testName,
      },
      {
        key: "price",
        header: "OP Price",
        align: "right" as const,
        render: (row: TariffRow) => (
          <DraftInput
            value={drafts[row.testId]?.price ?? baseline(row, "price")}
            disabled={saveMutation.isPending}
            onChange={(value) => updateDraft(row.testId, { price: value })}
          />
        ),
      },
      {
        key: "priceIp",
        header: "IP Price",
        align: "right" as const,
        render: (row: TariffRow) => (
          <DraftInput
            value={drafts[row.testId]?.priceIp ?? baseline(row, "priceIp")}
            disabled={saveMutation.isPending}
            onChange={(value) => updateDraft(row.testId, { priceIp: value })}
          />
        ),
      },
      {
        key: "priceInsIp",
        header: "Ins IP Price",
        align: "right" as const,
        render: (row: TariffRow) => (
          <DraftInput
            value={drafts[row.testId]?.priceInsIp ?? baseline(row, "priceInsIp")}
            disabled={saveMutation.isPending}
            onChange={(value) => updateDraft(row.testId, { priceInsIp: value })}
          />
        ),
      },
      {
        key: "priceEr",
        header: "ER Price",
        align: "right" as const,
        render: (row: TariffRow) => (
          <DraftInput
            value={drafts[row.testId]?.priceEr ?? baseline(row, "priceEr")}
            disabled={saveMutation.isPending}
            onChange={(value) => updateDraft(row.testId, { priceEr: value })}
          />
        ),
      },
    ],
    [selected, drafts, pagination, saveMutation.isPending],
  );

  return (
    <div className="lis-dm lis-tariffs space-y-3">
      <PageHeader
        icon={Percent}
        title="Lab Test Tariffs"
        subtitle="Set OP, IP, Ins IP and ER prices for lab tests"
      />

      <FormSection
        title="Department Tariff Set"
        description="Select a department to view and edit its tests"
        actions={
          <FormField id="tariff-dept" label="Select Department" className="w-64">
            <Select
              id="tariff-dept"
              className="h-8"
              value={departmentId}
              onChange={(event) => {
                setDepartmentId(event.target.value);
                setPage(1);
                setSelected({});
                setDrafts({});
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

          {departmentId ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                  <Checkbox
                    checked={allOnPageSelected}
                    onChange={(event) => toggleAll(event.target.checked)}
                    disabled={rows.length === 0 || saveMutation.isPending}
                  />
                  Select All
                </label>
                <span className="text-xs text-muted-foreground">
                  {selectedCount} test(s) selected
                </span>
              </div>
              <DataTable
                data={rows}
                rowKey={(row) => row.testId}
                loading={listQuery.isLoading}
                emptyMessage="No tests found in this department"
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
                  setSelected({});
                  setDrafts({});
                  window.scrollTo({ top: 0 });
                }}
                columns={columns}
              />

            </>
          ) : (
            <DataTable data={[]} rowKey={(row) => row.testId} columns={columns} emptyMessage="Select a department to load its test price set" />
          )}
        </div>
      </FormSection>
      <LabActions
        disabled={!departmentId}
        homeBeforeClear
        onSubmit={handleSubmit}
        onClear={handleClear}
        submitting={saveMutation.isPending}
        submitLabel="Save"
        homeHref="/dashboard"
      />
    </div>
  );
}