"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Pencil, ChevronsRight, Trash2 } from "lucide-react";
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
  updatePackage,
} from "@/services/database";
import type { LabPackage, PackageItem } from "@/types/database";
import { packageDraftPayload } from "@/lib/package-draft";
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
  insAmount: "0",
};

export function PackageCreateContent() {
  const queryClient = useQueryClient();
  const [departmentSearch, setDepartmentSearch] = useState("");
  const [testSearch, setTestSearch] = useState("");
  const [form, setForm] = useState<PackageFormState>(EMPTY_FORM);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [selectedTestId, setSelectedTestId] = useState("");
  const [items, setItems] = useState<SelectedItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

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
    queryFn: async () => {
      const first = await fetchLabTests({ departmentId: selectedDepartmentId === "all" ? undefined : selectedDepartmentId, status: "active", page: 1, limit: 100 });
      const items = [...first.items];
      for (let page = 2; page <= first.pagination.totalPages; page++) {
        const next = await fetchLabTests({ departmentId: selectedDepartmentId === "all" ? undefined : selectedDepartmentId, status: "active", page, limit: 100 });
        items.push(...next.items);
      }
      return { ...first, items };
    },
    enabled: Boolean(selectedDepartmentId),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["packages"] });
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = packageDraftPayload(form, items);
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
    setSelectedDepartmentId("");
    setSelectedTestId("");
    setTestSearch("");
    setDepartmentSearch("");
    saveMutation.reset();
  };

  const update = (patch: Partial<PackageFormState>) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const handleSave = () => {
    try { packageDraftPayload(form, items); }
    catch (reason) { setFeedback(reason instanceof Error ? reason.message : "Check package details"); return; }
    setFeedback(null);
    saveMutation.mutate();
  };


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
    <div className="lis-dm lis-package space-y-3">
      <PageHeader
        icon={Package}
        title="Create Package"
        subtitle="Combine lab tests into a billable package"
      />

      <div className="lis-package-details">
        <FormField id="pkg-name" label="Package Name" required>
          <Input id="pkg-name" value={form.name} maxLength={150} onChange={(event) => update({ name: event.target.value })} disabled={saveMutation.isPending} />
        </FormField>
        <FormField id="pkg-amount" label="Package Amount" required>
          <Input id="pkg-amount" type="number" min={0} step="0.01" value={form.amount} onChange={(event) => update({ amount: event.target.value })} disabled={saveMutation.isPending} />
        </FormField>
        <FormField id="pkg-ins" label="Package Amount Ins">
          <Input id="pkg-ins" type="number" min={0} step="0.01" value={form.insAmount} onChange={(event) => update({ insAmount: event.target.value })} disabled={saveMutation.isPending} />
        </FormField>
      </div>
      {feedback && <p role="status" className="text-xs text-slate-700">{feedback}</p>}
      {saveMutation.isError && <p role="alert" className="text-xs text-destructive">{saveMutation.error instanceof Error ? saveMutation.error.message : "Failed to save package"}</p>}
      <div className="lis-package-selector">
        <div className="lis-package-list">
          <label htmlFor="pkg-dept">* Departments</label>
          <Input aria-label="Search package departments" placeholder="Search..." value={departmentSearch} onChange={(event) => setDepartmentSearch(event.target.value)} disabled={saveMutation.isPending} />
          <Select id="pkg-dept" size={10} value={selectedDepartmentId} disabled={saveMutation.isPending} onChange={(event) => { setSelectedDepartmentId(event.target.value); setSelectedTestId(""); setTestSearch(""); }}>
            <option value="">Select--</option><option value="all">ALL</option>
            {departments.filter((record) => record.id === selectedDepartmentId || record.name.toLowerCase().includes(departmentSearch.toLowerCase())).map((record) => <option key={record.id} value={record.id}>{record.name}</option>)}
          </Select>
        </div>
        <div className="lis-package-list">
          <label htmlFor="pkg-test">* Lab Tests</label>
          <Input aria-label="Search package tests" placeholder="Search..." value={testSearch} disabled={!selectedDepartmentId || saveMutation.isPending} onChange={(event) => setTestSearch(event.target.value)} />
          <Select id="pkg-test" size={10} value={selectedTestId} disabled={!selectedDepartmentId || saveMutation.isPending || testsQuery.isPending} onChange={(event) => setSelectedTestId(event.target.value)}>
            <option value="">{testsQuery.isFetching ? "Loading tests…" : "Select a test"}</option>
            {tests.filter((test) => test.testName.toLowerCase().includes(testSearch.toLowerCase())).map((test) => <option key={test.id} value={test.id} disabled={items.some((item) => item.testId === test.id)}>{test.testName}</option>)}
          </Select>
          {testsQuery.isError && <p role="alert" className="text-xs text-destructive">Unable to load tests.</p>}
        </div>
        <Button type="button" variant="outline" size="icon-sm" aria-label="Transfer selected package test" onClick={handleAddTest} disabled={saveMutation.isPending || !selectedTestId || !tests.some((test) => test.id === selectedTestId) || items.some((item) => item.testId === selectedTestId)}><ChevronsRight /></Button>
        <div className="lis-selected-package-tests">
          <h3>Selected Lab Tests</h3>
          <DataTable data={items} rowKey={(item) => item.testId} emptyMessage="No tests selected yet" columns={[
            { key: "remove", header: "Del", render: (item) => <Button type="button" variant="ghost" size="icon-sm" disabled={saveMutation.isPending} aria-label={`Remove ${item.testName}`} onClick={() => handleRemoveItem(item.testId)}><Trash2 className="size-3.5" /></Button> },
            { key: "sno", header: "S No", render: (_item, index) => index + 1 },
            { key: "department", header: "Dept Name", render: (item) => item.departmentName },
            { key: "test", header: "Lab Test Name", render: (item) => item.testName },
          ]} />
        </div>
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
          setDepartmentSearch("");
          setTestSearch("");
          saveMutation.reset();
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
