"use client";

import { useMemo, useState } from "react";
import { invalidateMasterData } from "@/lib/master-data-cache";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layers, Pencil } from "lucide-react";
import { DataTable } from "@/components/database/data-table";
import { FormActions } from "@/components/database/form-actions";
import { FormField } from "@/components/database/form-field";
import { FormSection } from "@/components/database/form-section";
import { PageHeader } from "@/components/database/page-header";
import { SearchInput } from "@/components/database/search-input";
import { StatusBadge } from "@/components/database/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  createDatabaseDepartment,
  fetchDatabaseDepartments,
  getDatabaseOptions,
  updateDatabaseDepartment,
} from "@/services/database";
import type { Department } from "@/types/billing";

const PAGE_LIMIT = 20;

interface DepartmentFormState {
  name: string;
  code: string;
  type: string;
  sortOrder: string;
  description: string;
}

const EMPTY_FORM: DepartmentFormState = {
  name: "",
  code: "",
  type: "",
  sortOrder: "0",
  description: "",
};

export function DepartmentContent() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<DepartmentFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const [feedback, setFeedback] = useState<string | null>(null);

  const optionsQuery = useQuery({
    queryKey: ["database-options"],
    queryFn: getDatabaseOptions,
  });

  const listQuery = useQuery({
    queryKey: ["departments", "database"],
    queryFn: () => fetchDatabaseDepartments(),
    placeholderData: (previous) => previous,
  });

  const invalidate = () => {
    void invalidateMasterData(queryClient, "departments");
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim(),
        description: form.description.trim() || undefined,
        type: form.type || undefined,
        sortOrder: Number(form.sortOrder) || 0,
      };
      return editingId
        ? updateDatabaseDepartment(editingId, payload)
        : createDatabaseDepartment(payload);
    },
    onSuccess: () => {
      invalidate();
      setEditingId(null);
      setForm(EMPTY_FORM);
      setFeedback(
        editingId
          ? "Department updated successfully"
          : "Department created successfully",
      );
      window.setTimeout(() => setFeedback(null), 2500);
    },
  });



  const departmentTypes = optionsQuery.data?.departmentTypes ?? [];

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return (listQuery.data ?? []).filter((department) => {
      if (statusFilter === "active" && !department.active) return false;
      if (statusFilter === "inactive" && department.active) return false;
      if (!keyword) return true;
      return (
        department.name.toLowerCase().includes(keyword) ||
        department.code.toLowerCase().includes(keyword)
      );
    });
  }, [listQuery.data, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_LIMIT));
  const visible = filtered.slice((page - 1) * PAGE_LIMIT, page * PAGE_LIMIT);

  const update = (patch: Partial<DepartmentFormState>) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const handleSave = () => {
    if (form.name.trim().length < 2 || form.code.trim().length < 2) return;
    saveMutation.mutate();
  };

  const handleEdit = (department: Department) => {
    setEditingId(department.id);
    setForm({
      name: department.name,
      code: department.code,
      type: department.type ?? "",
      sortOrder: String(department.sortOrder ?? 0),
      description: department.description ?? "",
    });
    setFeedback(null);
  };

  const columns = [
    {
      key: "sno",
      header: "S.No",
      align: "center" as const,
      className: "w-16",
      render: (_row: Department, index: number) =>
        (page - 1) * PAGE_LIMIT + index + 1,
    },
    {
      key: "code",
      header: "Code",
      render: (row: Department) => (
        <span className="font-medium text-slate-800">{row.code}</span>
      ),
    },
    {
      key: "name",
      header: "Department",
      render: (row: Department) => <span>{row.name}</span>,
    },
    {
      key: "type",
      header: "Type",
      render: (row: Department) => (
        <span>{row.type ?? "Lab & X-Ray"}</span>
      ),
    },
    {
      key: "sortOrder",
      header: "Sort Order",
      align: "center" as const,
      render: (row: Department) => row.sortOrder,
    },
    {
      key: "status",
      header: "Status",
      align: "center" as const,
      render: (row: Department) => <StatusBadge active={row.active} />,
    },
    {
      key: "actions",
      header: "Action",
      align: "center" as const,
      render: (row: Department) => (
        <div className="flex items-center justify-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${row.name}`}
            onClick={() => handleEdit(row)}
          >
            <Pencil className="size-4" />
          </Button>
          
        </div>
      ),
    },
  ];

  return (
    <div className="lis-dm lis-department space-y-3">
      <PageHeader
        icon={Layers}
        title="Create Department"
        subtitle="Add and manage departments used across the lab"
      />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,30rem)_1fr]">
        <FormSection
          title={editingId ? "Edit Department" : "Add New Department"}
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
            <div className="grid gap-0 sm:grid-cols-2">
              <FormField id="dept-name" label="Department Name" required>
                <Input
                  id="dept-name"
                  value={form.name}
                  placeholder="e.g. HEMATOLOGY"
                  onChange={(event) => update({ name: event.target.value })}
                  disabled={saveMutation.isPending}
                />
              </FormField>
              <FormField id="dept-code" label="Short Name" required>
                <Input
                  id="dept-code"
                  value={form.code}
                  placeholder="e.g. HEMA"
                  maxLength={10}
                  onChange={(event) =>
                    update({ code: event.target.value.toUpperCase() })
                  }
                  disabled={saveMutation.isPending}
                />
              </FormField>
              <FormField id="dept-desc" label="Description">
                <Input
                  id="dept-desc"
                  value={form.description}
                  placeholder="Optional notes"
                  onChange={(event) => update({ description: event.target.value })}
                  disabled={saveMutation.isPending}
                />
              </FormField>
              <FormField id="dept-type" label="Type">
                <Select
                  id="dept-type"
                  value={form.type}
                  onChange={(event) => update({ type: event.target.value })}
                  disabled={saveMutation.isPending}
                >
                  <option value="">Select--</option>
                  {departmentTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField id="dept-sort" label="Sort Order">
                <Input
                  id="dept-sort"
                  type="number"
                  min={0}
                  max={9999}
                  value={form.sortOrder}
                  onChange={(event) => update({ sortOrder: event.target.value })}
                  disabled={saveMutation.isPending}
                />
              </FormField>
            </div>

            <FormActions
              homeBeforeReset
              onSubmit={handleSave}
              onReset={() => {
                setEditingId(null);
                setForm(EMPTY_FORM);
                setFeedback(null);
              }}
              submitting={saveMutation.isPending}
              submitLabel={editingId ? "Update" : "Submit"}
            />
          </div>
        </FormSection>

        <FormSection
          title="Department List"
          description="Departments are used to group lab tests"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Select
                aria-label="Filter by status"
                className="w-32"
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
              <SearchInput value={search} onChange={setSearch} placeholder="Search departments..." />
            </div>
          }
        >
          <DataTable
            data={visible}
            rowKey={(row) => row.id}
            loading={listQuery.isLoading}
            emptyMessage="No departments found"
            highlightId={editingId ?? undefined}
            pagination={{
              page,
              totalPages,
              total: filtered.length,
              limit: PAGE_LIMIT,
            }}
            onPageChange={setPage}
            columns={columns}
          />
        </FormSection>
      </div>


    </div>
  );
}
