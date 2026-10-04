"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Pencil, Plus, Trash2 } from "lucide-react";
import { DataTable } from "@/components/database/data-table";
import { FormActions } from "@/components/database/form-actions";
import { FormField } from "@/components/database/form-field";
import { FormSection } from "@/components/database/form-section";
import { PageHeader } from "@/components/database/page-header";
import { SearchInput } from "@/components/database/search-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { fetchLabTests } from "@/services/billing";
import {
  createPackage,
  fetchDatabaseDepartments,
  fetchPackages,
  getDatabaseOptions,
  updatePackage,
} from "@/services/database";
import type { LabPackage, PackageItem } from "@/types/database";
import { formatMoney } from "@/lib/utils";

const PAGE_LIMIT = 20;

interface SelectedItem {
  testId: string;
  testCode: string;
  testName: string;
  departmentId: string;
  departmentName: string;
}

interface PackageFormState {
  name: string;
  packageType: string;
  amount: string;
  insAmount: string;
}

const EMPTY_FORM: PackageFormState = {
  name: "",
  packageType: "Lab",
  amount: "",
  insAmount: "",
};

export function PackageCreateContent() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PackageFormState>(EMPTY_FORM);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [selectedTestId, setSelectedTestId] = useState("");
  const [items, setItems] = useState<SelectedItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const optionsQuery = useQuery({
    queryKey: ["database-options"],
    queryFn: getDatabaseOptions,
  });

  const departmentsQuery = useQuery({
    queryKey: ["departments", "database", "all"],
    queryFn: () => fetchDatabaseDepartments(),
  });

  const packagesQuery = useQuery({
    queryKey: ["packages", page, search],
    queryFn: () => fetchPackages({ page, limit: PAGE_LIMIT, search: search || undefined }),
    placeholderData: (previous) => previous,
  });

  const testsQuery = useQuery({
    queryKey: ["lab-tests", "package", selectedDepartmentId],
    queryFn: () =>
      fetchLabTests({
        departmentId: selectedDepartmentId || undefined,
        status: "active",
        page: 1,
        limit: 100,
      }),
    enabled: Boolean(selectedDepartmentId),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["packages"] });
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        packageType: form.packageType,
        amount: Number(form.amount) || 0,
        insAmount: form.insAmount.trim() === "" ? undefined : Number(form.insAmount),
        items: items.map((item) => ({
          testId: item.testId,
          departmentId: item.departmentId,
        })),
      };
      return editingId ? updatePackage(editingId, payload) : createPackage(payload);
    },
    onSuccess: () => {
      invalidate();
      setEditingId(null);
      setForm(EMPTY_FORM);
      setItems([]);
      setFeedback(
        editingId ? "Package updated successfully" : "Package created successfully",
      );
      window.setTimeout(() => setFeedback(null), 2500);
    },
  });

  const departments = useMemo(
    () => (departmentsQuery.data ?? []).filter((record) => record.active),
    [departmentsQuery.data],
  );

  const tests = testsQuery.data?.items ?? [];

  const handleAddTest = () => {
    const test = tests.find((entry) => entry.id === selectedTestId);
    if (!test || items.some((item) => item.testId === test.id)) return;
    const department = departments.find((record) => record.id === test.departmentId);
    setItems((current) => [
      ...current,
      {
        testId: test.id,
        testCode: test.testCode,
        testName: test.testName,
        departmentId: test.departmentId,
        departmentName: department?.name ?? "—",
      },
    ]);
    setSelectedTestId("");
  };

  const handleRemoveItem = (testId: string) => {
    setItems((current) => current.filter((item) => item.testId !== testId));
  };

  const handleEdit = (pkg: LabPackage) => {
    setEditingId(pkg.id);
    setForm({
      name: pkg.name,
      packageType: pkg.packageType,
      amount: String(pkg.amount ?? ""),
      insAmount: pkg.insAmount !== undefined ? String(pkg.insAmount) : "",
    });
    setItems(
      pkg.items.map((item: PackageItem) => ({
        testId: item.testId,
        testCode: item.testCode,
        testName: item.testName,
        departmentId: item.departmentId,
        departmentName: item.departmentName,
      })),
    );
    setFeedback(null);
  };

  const update = (patch: Partial<PackageFormState>) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const handleSave = () => {
    if (form.name.trim().length < 2) return;
    void saveMutation.mutateAsync();
  };

  const packageTypes = optionsQuery.data?.packageTypes ?? [];

  const columns = [
    { key: "sno", header: "S.No", align: "center" as const, className: "w-16", render: (_row: LabPackage, index: number) => (page - 1) * PAGE_LIMIT + index + 1 },
    {
      key: "name",
      header: "Package Name",
      render: (row: LabPackage) => (
        <span className="font-medium text-slate-800">{row.name}</span>
      ),
    },
    {
      key: "packageType",
      header: "Package Type",
      render: (row: LabPackage) => row.packageType,
    },
    {
      key: "amount",
      header: "Amount",
      align: "right" as const,
      render: (row: LabPackage) => formatMoney(row.amount),
    },
    {
      key: "insAmount",
      header: "Ins Amount",
      align: "right" as const,
      render: (row: LabPackage) =>
        row.insAmount !== undefined ? formatMoney(row.insAmount) : "—",
    },
    {
      key: "actions",
      header: "Edit",
      align: "center" as const,
      render: (row: LabPackage) => (
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
    <div className="space-y-3">
      <PageHeader
        icon={Package}
        title="Create Package"
        subtitle="Combine lab tests into a billable package"
      />

      <div className="grid gap-3 lg:grid-cols-3">
        <FormSection title="Package Details" description="Name and pricing for the package">
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
                  : "Failed to save package"}
              </p>
            )}
            <FormField id="pkg-name" label="Package Name" required>
              <Input
                id="pkg-name"
                value={form.name}
                placeholder="e.g. FEVER PROFILE"
                onChange={(event) => update({ name: event.target.value })}
                disabled={saveMutation.isPending}
              />
            </FormField>
            <FormField id="pkg-type" label="Package Type" required>
              <Select
                id="pkg-type"
                value={form.packageType}
                onChange={(event) => update({ packageType: event.target.value })}
                disabled={saveMutation.isPending}
              >
                {packageTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
            </FormField>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField id="pkg-amount" label="Package Amount" required>
                <Input
                  id="pkg-amount"
                  type="number"
                  min={0}
                  value={form.amount}
                  placeholder="0.00"
                  onChange={(event) => update({ amount: event.target.value })}
                  disabled={saveMutation.isPending}
                />
              </FormField>
              <FormField id="pkg-ins" label="Package Amount In">
                <Input
                  id="pkg-ins"
                  type="number"
                  min={0}
                  value={form.insAmount}
                  placeholder="0.00"
                  onChange={(event) => update({ insAmount: event.target.value })}
                  disabled={saveMutation.isPending}
                />
              </FormField>
            </div>
          </div>
        </FormSection>

        <FormSection title="Select Tests" description="Pick a department and choose tests to include">
          <div className="space-y-3">
            <FormField id="pkg-dept" label="Department" required>
              <Select
                id="pkg-dept"
                value={selectedDepartmentId}
                onChange={(event) => {
                  setSelectedDepartmentId(event.target.value);
                  setSelectedTestId("");
                }}
                disabled={saveMutation.isPending}
              >
                <option value="">Select--</option>
                {departments.map((record) => (
                  <option key={record.id} value={record.id}>
                    {record.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField id="pkg-test" label="Test">
              <div className="space-y-1.5">
                <Select
                  id="pkg-test"
                  value={selectedTestId}
                  disabled={!selectedDepartmentId || saveMutation.isPending}
                  onChange={(event) => setSelectedTestId(event.target.value)}
                >
                  <option value="">
                    {selectedDepartmentId ? "Select a test" : "Select a department first"}
                  </option>
                  {tests.map((test) => (
                    <option key={test.id} value={test.id}>
                      {test.testCode} — {test.testName}
                    </option>
                  ))}
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleAddTest}
                  disabled={
                    !selectedTestId ||
                    items.some((item) => item.testId === selectedTestId)
                  }
                >
                  <Plus />
                  Add Test
                </Button>
              </div>
            </FormField>
          </div>
        </FormSection>

        <FormSection
          title="Selected Tests"
          description={`${items.length} test${items.length === 1 ? "" : "s"} added`}
          actions={
            items.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setItems([])}
              >
                <Trash2 />
                Clear All
              </Button>
            ) : undefined
          }
        >
          {items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No tests selected yet
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li key={item.testId} className="flex items-center justify-between gap-2 py-1.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {item.testName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.departmentName}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${item.testName}`}
                    onClick={() => handleRemoveItem(item.testId)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </FormSection>
      </div>

      <FormActions
        onSubmit={handleSave}
        onReset={() => {
          setEditingId(null);
          setForm(EMPTY_FORM);
          setItems([]);
          setSelectedDepartmentId("");
          setSelectedTestId("");
          setFeedback(null);
        }}
        submitting={saveMutation.isPending}
        submitLabel={editingId ? "Update" : "Save"}
      />

      <FormSection
        title="Package List"
        description="All configured packages"
        actions={<SearchInput value={search} onChange={setSearch} placeholder="Search packages..." />}
      >
        <DataTable
          data={packagesQuery.data?.data ?? []}
          rowKey={(row) => row.id}
          loading={packagesQuery.isLoading}
          emptyMessage="No packages found"
          highlightId={editingId ?? undefined}
          pagination={
            packagesQuery.data
              ? {
                  page: packagesQuery.data.pagination.page,
                  totalPages: packagesQuery.data.pagination.totalPages,
                  total: packagesQuery.data.pagination.total,
                  limit: packagesQuery.data.pagination.limit,
                }
              : undefined
          }
          onPageChange={setPage}
          columns={columns}
        />
      </FormSection>
    </div>
  );
}