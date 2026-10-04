"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Power, type LucideIcon } from "lucide-react";
import { ConfirmDialog } from "@/components/database/confirm-dialog";
import { DataTable } from "@/components/database/data-table";
import { FormActions } from "@/components/database/form-actions";
import { FormField } from "@/components/database/form-field";
import { FormSection } from "@/components/database/form-section";
import { PageHeader } from "@/components/database/page-header";
import { SearchInput } from "@/components/database/search-input";
import { StatusBadge } from "@/components/database/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  DatabaseListParams,
} from "@/services/database";
import type {
  MasterRecord,
  MasterResponse,
  PaginatedResult,
} from "@/types/database";

interface MasterServices {
  fetch: (params: DatabaseListParams) => Promise<PaginatedResult<MasterRecord>>;
  create: (name: string) => Promise<MasterResponse>;
  update: (id: string, name: string) => Promise<MasterResponse>;
  setActive: (id: string, active: boolean) => Promise<MasterResponse>;
}

interface MasterContentProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  formTitle: string;
  recordLabel: string;
  placeholder: string;
  services: MasterServices;
  limit?: number;
}

export function MasterContent({
  icon: Icon,
  title,
  subtitle,
  formTitle,
  recordLabel,
  placeholder,
  services,
  limit = 20,
}: MasterContentProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [confirmTarget, setConfirmTarget] = useState<{
    id: string;
    name: string;
    active: boolean;
  } | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const nameErrorRendered = name.trim().length > 0 && name.trim().length < 2;

  const listQuery = useQuery({
    queryKey: [recordLabel, "list", page, search],
    queryFn: () => services.fetch({ page, limit, search: search || undefined }),
    placeholderData: (previous) => previous,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: [recordLabel] });
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const trimmed = name.trim();
      return editingId
        ? services.update(editingId, trimmed)
        : services.create(trimmed);
    },
    onSuccess: () => {
      invalidate();
      setEditingId(null);
      setName("");
      setFeedback(
        editingId
          ? `${recordLabel} updated successfully`
          : `${recordLabel} saved successfully`,
      );
      window.setTimeout(() => setFeedback(null), 2500);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      services.setActive(id, active),
    onSuccess: () => {
      invalidate();
      setConfirmTarget(null);
    },
  });

  const handleSave = () => {
    if (name.trim().length < 2) return;
    void saveMutation.mutateAsync();
  };

  const handleClear = () => {
    setName("");
    setEditingId(null);
    setFeedback(null);
  };

  const handleEdit = (record: MasterRecord) => {
    setEditingId(record.id);
    setName(record.name);
    setFeedback(null);
  };

  const columns = useMemo(
    () => [
      {
        key: "sno",
        header: "S.No",
        align: "center" as const,
        className: "w-16",
        render: (_record: MasterRecord, index: number) =>
          (page - 1) * limit + index + 1,
      },
      {
        key: "name",
        header: recordLabel,
        render: (record: MasterRecord) => (
          <span className="font-medium text-slate-800">{record.name}</span>
        ),
      },
      {
        key: "status",
        header: "Status",
        align: "center" as const,
        render: (record: MasterRecord) => (
          <StatusBadge active={record.active} />
        ),
      },
      {
        key: "actions",
        header: "Action",
        align: "center" as const,
        render: (record: MasterRecord) => (
          <div className="flex items-center justify-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Edit ${record.name}`}
              onClick={() => handleEdit(record)}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={record.active ? `Deactivate ${record.name}` : `Activate ${record.name}`}
              onClick={() =>
                setConfirmTarget({
                  id: record.id,
                  name: record.name,
                  active: record.active,
                })
              }
            >
              <Power className="size-4" />
            </Button>
          </div>
        ),
      },
    ],
    [page, limit, recordLabel],
  );

  return (
    <div className="space-y-3">
      <PageHeader icon={Icon} title={title} subtitle={subtitle} />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,28rem)_1fr]">
        <FormSection
          title={editingId ? `Edit ${formTitle}` : formTitle}
          description={
            editingId
              ? "Update the details and save"
              : "Enter the details and save"
          }
        >
          <div className="space-y-3">
            {feedback && (
              <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/20">
                {feedback}
              </p>
            )}
            {saveMutation.isError && (
              <p className="rounded-md bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive ring-1 ring-destructive/20">
                {saveMutation.error instanceof Error
                  ? saveMutation.error.message
                  : "Failed to save"}
              </p>
            )}
            <FormField
              id="record-name"
              label={recordLabel}
              required
              error={
                nameErrorRendered
                  ? "Must be at least 2 characters"
                  : undefined
              }
            >
              <Input
                id="record-name"
                value={name}
                placeholder={placeholder}
                autoFocus
                onChange={(event) => setName(event.target.value)}
                disabled={saveMutation.isPending || toggleMutation.isPending}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleSave();
                  }
                }}
              />
            </FormField>
            <FormActions
              onSubmit={handleSave}
              onReset={handleClear}
              submitting={saveMutation.isPending}
              submitLabel={editingId ? "Update" : "Save"}
            />
          </div>
        </FormSection>

        <FormSection
          title={`${recordLabel} List`}
          actions={<SearchInput value={search} onChange={setSearch} placeholder="Search records..." />}
        >
          <DataTable
            data={listQuery.data?.data ?? []}
            rowKey={(record) => record.id}
            loading={listQuery.isLoading}
            emptyMessage={`No ${recordLabel.toLowerCase()} found`}
            highlightId={editingId ?? undefined}
            pagination={
              listQuery.data
                ? {
                    page: listQuery.data.pagination.page,
                    totalPages: listQuery.data.pagination.totalPages,
                    total: listQuery.data.pagination.total,
                    limit: listQuery.data.pagination.limit,
                  }
                : undefined
            }
            onPageChange={setPage}
            columns={columns}
          />
        </FormSection>
      </div>

      <ConfirmDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null);
        }}
        title={
          confirmTarget?.active
            ? "Deactivate record?"
            : "Activate record?"
        }
        description={
          confirmTarget
            ? `Do you want to ${confirmTarget.active ? "deactivate" : "activate"} "${confirmTarget.name}"?`
            : undefined
        }
        confirmLabel={confirmTarget?.active ? "Deactivate" : "Activate"}
        loading={toggleMutation.isPending}
        onConfirm={() => {
          if (confirmTarget) {
            void toggleMutation.mutate({ id: confirmTarget.id, active: !confirmTarget.active });
          }
        }}
      />
    </div>
  );
}