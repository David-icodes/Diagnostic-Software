"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { ConfirmDialog } from "@/components/database/confirm-dialog";
import { DataTable } from "@/components/database/data-table";
import { FormField } from "@/components/database/form-field";
import { FormSection } from "@/components/database/form-section";
import { PageHeader } from "@/components/database/page-header";
import { LabActions } from "@/components/lab/lab-actions";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { fetchDepartments } from "@/services/billing";
import {
  applyClientTariffs,
  fetchAllActiveClients,
  fetchClientTariffs,
} from "@/services/lab-masters";
import type { ClientTariffRow } from "@/types/lab-masters";
import { cn, formatMoney } from "@/lib/utils";

interface ClientTariffDraft {
  price: string;
}

function toNum(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function ClientLabTariffsContent() {
  const queryClient = useQueryClient();
  const [clientId, setClientId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [drafts, setDrafts] = useState<Record<string, ClientTariffDraft>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [overwrite, setOverwrite] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [notice, setNotice] = useState<{
    kind: "success" | "warn" | "error";
    text: string;
  } | null>(null);

  const clientsQuery = useQuery({
    queryKey: ["lab-clients", "lab-master"],
    queryFn: fetchAllActiveClients,
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

  const enabled = clientId.length > 0 && departmentId.length > 0;

  const tariffsQuery = useQuery({
    queryKey: ["client-tariffs", { clientId, departmentId }],
    queryFn: () => fetchClientTariffs(clientId, departmentId),
    enabled,
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const rows = (tariffsQuery.data ?? [])
        .filter((row) => selected[row.testId])
        .map((row) => ({
          testId: row.testId,
          price: toNum(drafts[row.testId]?.price) ?? row.price,
        }));
      return applyClientTariffs(clientId, departmentId, rows, overwrite);
    },
    onSuccess: (result) => {
      setSelected({});
      setDrafts({});
      void queryClient.invalidateQueries({
        queryKey: ["client-tariffs", { clientId, departmentId }],
      });
      showNotice(
        "success",
        `Tariffs applied to ${result.applied} test(s)${result.removed > 0 ? `, removed ${result.removed}` : ""}`,
      );
    },
    onError: (error) => {
      showNotice(
        "error",
        error instanceof Error
          ? `${error.message}${overwrite ? "" : " Please tick the \"Copy The Above Tariff Set\" box to overwrite."}`
          : "Failed to apply client tariffs",
      );
    },
  });

  const showNotice = (kind: "success" | "warn" | "error", text: string) => {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), 3500);
  };

  const clients = (clientsQuery.data ?? []).filter((client) => client.active !== false);
  const departments = departmentsQuery.data ?? [];
  const rows = tariffsQuery.data ?? [];

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

  const updateDraft = (testId: string, price: string) => {
    setDrafts((current) => ({
      ...current,
      [testId]: { price },
    }));
  };

  const handleSubmit = () => {
    if (!enabled) return;
    if (selectedCount === 0) {
      showNotice("warn", "Select at least one test to apply the client tariff");
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
        render: (row: ClientTariffRow) => (
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
        render: (_row: ClientTariffRow, index: number) => index + 1,
      },
      {
        key: "testName",
        header: "Test Name",
        render: (row: ClientTariffRow) => (
          <span className="font-medium text-slate-800">{row.testName}</span>
        ),
      },
      {
        key: "price",
        header: "OP Price",
        align: "right" as const,
        render: (row: ClientTariffRow) => (
          <span className="font-medium text-slate-800">{formatMoney(row.price)}</span>
        ),
      },
      {
        key: "clientPrice",
        header: "Client Price",
        align: "right" as const,
        render: (row: ClientTariffRow) => (
          <div className="flex justify-end">
            <Input
              type="number"
              min={0}
              step="0.01"
              className="h-7 w-24 text-right"
              value={
                drafts[row.testId]?.price ??
                (row.clientPrice !== undefined ? String(row.clientPrice) : String(row.price))
              }
              placeholder="0.00"
              onChange={(event) => updateDraft(row.testId, event.target.value)}
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
        icon={Building2}
        title="Client Wise Lab Tariffs"
        subtitle="Set client specific pricing for lab tests"
      />

      <FormSection
        title="Select Client & Department"
        description="Choose a client and department to configure its test pricing"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:max-w-3xl">
          <FormField id="client-tariff-client" label="Select Client Name" required>
            <Select
              id="client-tariff-client"
              className="h-8"
              value={clientId}
              onChange={(event) => {
                setClientId(event.target.value);
                setSelected({});
                setDrafts({});
                setOverwrite(false);
                setNotice(null);
              }}
            >
              <option value="">--Select--</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="client-tariff-dept" label="Select Department" required>
            <Select
              id="client-tariff-dept"
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
        title="Client Tariff Set"
        description={
          enabled
            ? "Adjust the client price for each selected test"
            : "Select a client and department to load its tests"
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
                loading={tariffsQuery.isLoading}
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
              Select a client and department to load its tariff set
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
        description="The selected tests already have a client tariff. Continue will overwrite the existing client price for the selected tests."
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