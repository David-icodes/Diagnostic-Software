"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Inbox, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { fetchDepartments, fetchLabTests } from "@/services/billing";
import { formatMoney, cn } from "@/lib/utils";
import type { LabTest } from "@/types/billing";

export interface SelectedTestItem {
  testId: string;
  testCode: string;
  testName: string;
  departmentName: string;
  unitPrice: number;
  quantity: number;
}

interface TestSelectorProps {
  items: SelectedTestItem[];
  onAdd: (test: LabTest, departmentName: string) => void;
  onRemove: (testId: string) => void;
  onQuantityChange: (testId: string, quantity: number) => void;
}

export function TestSelector({
  items,
  onAdd,
  onRemove,
  onQuantityChange,
}: TestSelectorProps) {
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [departmentSearch, setDepartmentSearch] = useState("");
  const [testSearchInput, setTestSearchInput] = useState("");
  const [testSearch, setTestSearch] = useState("");

  const departmentsQuery = useQuery({
    queryKey: ["departments", "all"],
    queryFn: () => fetchDepartments({ status: "active" }),
  });

  const testsQuery = useQuery({
    queryKey: ["lab-tests", "by-department", selectedDepartmentId, testSearch],
    queryFn: () =>
      fetchLabTests({
        departmentId: selectedDepartmentId ?? undefined,
        search: testSearch || undefined,
        status: "active",
        page: 1,
        limit: 100,
      }),
    enabled: Boolean(selectedDepartmentId),
  });

  const departments = departmentsQuery.data ?? [];
  const visibleDepartments = departmentSearch.trim()
    ? departments.filter((department) =>
        department.name.toLowerCase().includes(departmentSearch.trim().toLowerCase()),
      )
    : departments;
  const tests = testsQuery.data?.items ?? [];

  const selectedIds = new Set(items.map((item) => item.testId));
  const totalAmount = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );

  const activeDepartment = departments.find(
    (department) => department.id === selectedDepartmentId,
  );

  const addAllVisible = () => {
    const departmentName = activeDepartment?.name ?? "Unknown";
    tests.forEach((test) => onAdd(test, departmentName));
  };

  const panelClass =
    "flex min-h-0 h-[min(240px,44vh)] flex-col overflow-hidden rounded-[4px] border border-border/80 bg-card";
  const panelTitleClass = "text-[13px] font-semibold text-slate-700";

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:gap-3">
      <div className={cn(panelClass, "lg:w-[24%]")}>
        <div className="space-y-2 border-b border-border/80 px-2 py-1.5">
          <h3 className={panelTitleClass}>
            <span className="text-destructive">* </span>Departments
          </h3>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search departments..."
              value={departmentSearch}
              onChange={(event) => setDepartmentSearch(event.target.value)}
              className="h-8 pl-7 text-xs"
              aria-label="Search departments"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {departmentsQuery.isLoading ? (
            <div className="flex flex-col gap-1.5 p-2" aria-busy>
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="h-[30px] animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : departmentsQuery.error ? (
            <ErrorState
              message={departmentsQuery.error.message}
              onRetry={() => void departmentsQuery.refetch()}
            />
          ) : visibleDepartments.length === 0 ? (
            <EmptyState message="No departments found" />
          ) : (
            <ul>
              {visibleDepartments.map((department) => {
                const active = department.id === selectedDepartmentId;
                return (
                  <li key={department.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDepartmentId(department.id);
                        setTestSearchInput("");
                        setTestSearch("");
                      }}
                      className={cn(
                        "flex h-[28px] w-full items-center justify-between gap-2 px-2 text-left text-xs transition-colors",
                        active
                          ? "bg-muted font-medium text-slate-800"
                          : "text-slate-700 hover:bg-slate-50",
                      )}
                    >
                      <span className="truncate">{department.name}</span>
                      <span
                        className={cn(
                          "text-[11px]",
                          active
                            ? "text-slate-500"
                            : "text-muted-foreground",
                        )}
                      >
                        {department.testCount}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className={cn(panelClass, "lg:w-[24%]")}>
        <div className="space-y-2 border-b border-border/80 px-2 py-1.5">
          <h3 className={panelTitleClass}>
            <span className="text-destructive">* </span>Lab Tests
          </h3>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search tests..."
              value={testSearchInput}
              onChange={(event) => {
                setTestSearchInput(event.target.value);
                setTestSearch(event.target.value.trim());
              }}
              className="h-8 pl-7 text-xs"
              disabled={!selectedDepartmentId}
              aria-label="Search tests"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {!selectedDepartmentId ? (
            <EmptyState message="Select a department to view tests" />
          ) : testsQuery.isLoading ? (
            <div className="flex flex-col gap-1.5 p-2" aria-busy>
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-[28px] animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : testsQuery.error ? (
            <ErrorState
              message={testsQuery.error.message}
              onRetry={() => void testsQuery.refetch()}
            />
          ) : tests.length === 0 ? (
            <EmptyState message="No tests found" />
          ) : (
            <ul className="divide-y divide-border/70">
              {tests.map((test) => {
                const added = selectedIds.has(test.id);
                return (
                  <li key={test.id}>
                    <div className="flex min-h-[28px] items-center justify-between gap-2 px-2 py-0.5">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-slate-800">
                          {test.testName}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          <span className="font-mono">{test.testCode}</span>
                          {" · "}
                          ₹{formatMoney(test.price)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={added ? "secondary" : "outline"}
                        onClick={() =>
                          onAdd(test, activeDepartment?.name ?? "Unknown")
                        }
                        disabled={added}
                        className="h-7 shrink-0 text-xs"
                      >
                        {added ? "Added" : <Plus />}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="flex items-center py-1 lg:w-[5%] lg:justify-center lg:py-0 lg:pt-[58px]">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={addAllVisible}
          disabled={tests.length === 0}
          title="Add all listed tests"
          aria-label="Transfer all tests"
          className="size-8 shrink-0 border-border bg-card"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className={cn(panelClass, "min-w-0 flex-1")}>
        <div className="flex items-center justify-between border-b border-border/80 px-2 py-1.5">
          <h3 className={panelTitleClass}>Selected Lab Tests</h3>
          <span className="text-[11px] text-muted-foreground">
            {items.length} item{items.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="min-w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="w-10 px-2 py-1">
                  <span className="sr-only">Delete</span>
                  <Trash2 className="size-3" />
                </th>
                <th className="w-12 px-2 py-1">S No</th>
                <th className="px-2 py-1">Dept Name</th>
                <th className="px-2 py-1">Lab Test Name</th>
                <th className="px-2 py-1 text-right">Amount</th>
                <th className="w-20 px-2 py-1 text-center">Qty</th>
                <th className="px-2 py-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr data-empty>
                  <td colSpan={7} className="h-full px-2 py-4 text-center">
                    <Inbox className="mx-auto size-6 text-slate-300" />
                    <p className="mt-1 text-xs text-muted-foreground">
                      No tests selected yet
                    </p>
                  </td>
                </tr>
              ) : (
                items.map((item, index) => (
                  <tr
                    key={item.testId}
                    className="border-t border-border/70"
                  >
                    <td className="px-2 py-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onRemove(item.testId)}
                        aria-label={`Delete ${item.testName}`}
                        className="text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 />
                      </Button>
                    </td>
                    <td className="px-2 py-1 text-slate-600">{index + 1}</td>
                    <td className="px-2 py-1 text-[11px] text-slate-600">
                      {item.departmentName}
                    </td>
                    <td className="px-2 py-1">
                      <p className="truncate text-xs font-medium text-slate-800">
                        {item.testName}
                      </p>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {item.testCode}
                      </p>
                    </td>
                    <td className="px-2 py-1 text-right text-slate-700">
                      {formatMoney(item.unitPrice)}
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={100}
                        value={item.quantity}
                        onChange={(event) => {
                          const parsed = Number(event.target.value);
                          if (Number.isFinite(parsed)) {
                            onQuantityChange(item.testId, parsed);
                          }
                        }}
                        className="mx-auto h-7 w-14 px-1 text-center text-xs"
                        aria-label={`Quantity for ${item.testName}`}
                      />
                    </td>
                    <td className="px-2 py-1 text-right font-semibold text-slate-800">
                      {formatMoney(item.unitPrice * item.quantity)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-border/80 bg-slate-50 px-2 py-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">
            Subtotal
          </span>
          <span className="text-xs font-semibold text-slate-800">
            ₹{formatMoney(totalAmount)}
          </span>
        </div>
      </div>
    </div>
  );
}