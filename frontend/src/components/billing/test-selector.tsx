"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronsRight, Inbox, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { fetchDepartments, fetchAllEligibleLabTests, fetchLabTest } from "@/services/billing";
import { formatMoney, cn } from "@/lib/utils";
import type { LabTest } from "@/types/billing";
import { departmentFilter } from "@/lib/catalogue-selection";
import { selectedTransfer } from "@/lib/lab-workflows";
import { api } from "@/lib/api";

export interface OutsideChoice { out?: boolean; outsideLabId?: string | null; outsideLabName?: string; }

export interface SelectedTestItem extends OutsideChoice {
  packageId?: string;
  includedTests?: { testId: string; testName: string; departmentName: string }[];
  testId: string;
  testCode: string;
  testName: string;
  departmentName: string;
  unitPrice: number;
  quantity: number;
  containerType?: string;
}

interface TestSelectorProps {
  allowPackages?: boolean;
  catalogueSource?: {departments:{id:string;name:string;testCount?:number}[];tests:LabTest[]};
  items: SelectedTestItem[];
  onAdd: (test: LabTest, departmentName: string, outside?: OutsideChoice) => void;
  onRemove: (testId: string) => void;
  onQuantityChange: (testId: string, quantity: number) => void;
  onUnitPriceChange?: (testId: string, raw: string) => void;
  disabled?: boolean;
  selectedTitle?: string;
  showSerial?: boolean;
}

export function TestSelector({
  allowPackages=false,
  catalogueSource,
  items,
  onAdd,
  onRemove,
  onUnitPriceChange,
  disabled = false,
  selectedTitle = "Selected Lab Tests",
  showSerial = true,
}: TestSelectorProps) {
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [departmentSearch, setDepartmentSearch] = useState("");
  const [testSearchInput, setTestSearchInput] = useState("");
  const [testSearch, setTestSearch] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [focusedTestId, setFocusedTestId] = useState<string | null>(null);

  const departmentsQuery = useQuery({
    queryKey: ["departments", "all"],
    queryFn: () => fetchDepartments({ status: "active" }),
    enabled:!catalogueSource,
  });

  const testsQuery = useQuery({
    queryKey: ["lab-tests", "by-department", selectedDepartmentId, testSearch],
    queryFn: () =>
      fetchAllEligibleLabTests({
        departmentId: departmentFilter(selectedDepartmentId),
        search: testSearch || undefined,
        status: "active",
        page: 1,
        limit: 100,
      }),
    enabled: !catalogueSource&&Boolean(selectedDepartmentId)&&selectedDepartmentId!=="__packages",
  });
  const packagesQuery=useQuery({queryKey:["packages","billing",testSearch],enabled:allowPackages&&(selectedDepartmentId==="__packages"||selectedDepartmentId==="__all"),queryFn:()=>api.get<{id:string;name:string;amount:number;items:{testId:string;departmentId:string}[]}[]>(`/lab-tests/packages?${new URLSearchParams({search:testSearch})}`)});

  const containerQuery = useQuery({
    queryKey: ["lab-tests", "selected-containers", items.filter((item) => !item.packageId && item.containerType === undefined).map((item) => item.testId)],
    queryFn: async () => Object.fromEntries(await Promise.all(items.filter((item) => !item.packageId && item.containerType === undefined).map(async (item) => {
      try { const test = await fetchLabTest(item.testId); return [item.testId, test.containerType ?? ""]; }
      catch { return [item.testId, ""]; }
    }))), enabled: !catalogueSource&&items.some((item) => !item.packageId && item.containerType === undefined),
  });
  const departments = [{id:"__all",name:"ALL",active:true,testCount:undefined},...(catalogueSource?.departments??departmentsQuery.data??[]),...(allowPackages?[{id:"__packages",name:"Packages/Profiles",active:true,testCount:packagesQuery.data?.length??0}]:[])];
  const visibleDepartments = departmentSearch.trim()
    ? departments.filter((department) =>
        department.name.toLowerCase().includes(departmentSearch.trim().toLowerCase()),
      )
    : departments;
  const packageOptions: LabTest[] = (packagesQuery.data ?? []).map(pack => ({id:pack.id,packageId:pack.id,testCode:"PACKAGE",testName:pack.name,shortName:pack.name,departmentId:"__packages",price:pack.amount,active:true,resultMode:"PARAMETER_BASED"}));
  const tests: LabTest[] = catalogueSource ? catalogueSource.tests.filter(test=>(selectedDepartmentId==="__all"||test.departmentId===selectedDepartmentId)&&`${test.testName} ${test.testCode}`.toLowerCase().includes(testSearch.toLowerCase())) : selectedDepartmentId === "__packages" ? packageOptions : [...(testsQuery.data?.items ?? []).filter(test => departmentsQuery.data?.some(department => department.id === test.departmentId)), ...(selectedDepartmentId === "__all" ? packageOptions : [])];
  const selectionQuery = selectedDepartmentId === "__packages" ? packagesQuery : testsQuery;
  const selectionError = !catalogueSource && (selectionQuery.error || (selectedDepartmentId === "__all" ? packagesQuery.error : null));
  const selectionLoading = !catalogueSource && (selectionQuery.isLoading || (selectedDepartmentId === "__all" && packagesQuery.isLoading));

  const selectedIds = new Set(items.map((item) => item.testId));
  const totalAmount = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );

  const activeDepartment = departments.find(
    (department) => department.id === selectedDepartmentId,
  );

  const transferTest = selectedTransfer(tests, focusedTestId, selectedIds);
  const transferSelected = () => {
    if (!transferTest || !activeDepartment || disabled) return;
    onAdd(transferTest, transferTest.packageId ? "Packages/Profiles" : departments.find(dept => dept.id === transferTest.departmentId)?.name ?? "Unassigned");
    setSelectedItemId(transferTest.id);
    setFocusedTestId(null);
    // A search narrows the list for one transfer only. Clearing it immediately
    // lets the next test be picked from the full department without retyping.
    setTestSearchInput("");
    setTestSearch("");
  };

  const panelClass =
    "flex min-h-0 h-[min(240px,44vh)] flex-col overflow-hidden rounded-[4px] border border-border/80 bg-card";
  const panelTitleClass = "text-[13px] font-semibold text-slate-700";

  return (
    <div data-serial={showSerial} className="lis-test-selector flex flex-col gap-3 lg:flex-row lg:gap-3">
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
          {!catalogueSource && departmentsQuery.isLoading ? (
            <div className="flex flex-col gap-1.5 p-2" aria-busy>
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="h-[30px] animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : !catalogueSource && departmentsQuery.error ? (
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
                        setFocusedTestId(null);
                      }}
                      className={cn(
                        "flex h-[28px] w-full items-center justify-between gap-2 px-2 text-left text-xs transition-colors",
                        active
                          ? "bg-muted font-medium text-slate-800"
                          : "text-slate-700 hover:bg-slate-50",
                      )}
                      aria-pressed={active}
                    >
                      <span className="truncate">{department.name}</span>

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
          ) : selectionLoading ? (
            <div className="flex flex-col gap-1.5 p-2" aria-busy>
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-[28px] animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : selectionError ? (
            <ErrorState
              message={selectionError.message}
              onRetry={() => { void testsQuery.refetch(); if (allowPackages) void packagesQuery.refetch(); }}
            />
          ) : tests.length === 0 ? (
            <EmptyState message="No tests found" />
          ) : (
            <ul className="divide-y divide-border/70">
              {tests.map((test) => {
                const active = focusedTestId === test.id;
                return (
                  <li key={test.id}>
                    <button type="button" disabled={disabled || selectedIds.has(test.id)} aria-pressed={active && !selectedIds.has(test.id)}
                      onClick={() => setFocusedTestId(test.id)}
                      className="lis-test-option min-h-[30px] w-full px-2 py-1 text-left text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed">
                      {test.testName}
                    </button>
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
          onClick={transferSelected}
          disabled={disabled || !transferTest}
          title="Transfer selected test"
          aria-label="Transfer selected test"
          className="size-8 shrink-0 border-border bg-card"
        >
          <ChevronsRight className="size-4" />
        </Button>
      </div>

      <div className={cn(panelClass, "min-w-0 flex-1")}>
        <div className="flex items-center justify-between border-b border-border/80 px-2 py-1.5">
          <h3 className={panelTitleClass}>{selectedTitle}</h3>
          <span className="text-[11px] text-muted-foreground">
            {items.length} item{items.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="lis-selected-tests-table w-full min-w-0 table-fixed text-xs">
            <colgroup>{[10,18,29,12,19,12].map((width,index)=><col key={index} style={{width:width+"%"}} />)}</colgroup>
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-100 text-left text-xs font-semibold text-slate-500 [&>th]:whitespace-nowrap">
                <th className="px-2 py-1 whitespace-nowrap">S No</th>
                <th className="px-2 py-1">Dept Name</th>
                <th className="px-2 py-1">Lab Test Name</th>
                <th className="px-2 py-1 text-right">Amount</th>
                <th className="px-2 py-1 text-center whitespace-nowrap">Tube Container</th>
                <th className="px-2 py-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr data-empty>
                  <td colSpan={6} className="h-full px-2 py-4 text-center">
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
                    aria-selected={selectedItemId === item.testId}
                    onClick={() => setSelectedItemId(item.testId)}
                    className="border-t border-border/70"
                  >
                    <td className="px-2 py-1">
                      {showSerial && <span>{index + 1}</span>}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={disabled}
                        onClick={() => onRemove(item.testId)}
                        aria-label={`Delete ${item.testName}`}
                        className="text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 />
                      </Button>
                    </td>

                    <td className="px-2 py-1 text-[11px] text-slate-600">
                      {item.departmentName}
                    </td>
                    <td className="px-2 py-1">
                      <p className="break-words text-xs font-medium text-slate-800">
                        {item.testName}
                      </p>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {item.testCode === "INVG2044" ? "" : item.testCode}
                      </p>
                    </td>
                    <td className="px-2 py-1 text-right text-slate-700">
                      {onUnitPriceChange && !item.packageId ? (
                        <Input type="number" inputMode="decimal" min={0} max={100_000_000} step="0.01"
                          aria-label={`Selected test price for ${item.testName}`}
                          value={item.unitPrice} disabled={disabled}
                          onChange={event => onUnitPriceChange(item.testId, event.target.value)}
                          className="ml-auto h-8 w-full min-w-0 text-right text-xs" />
                      ) : formatMoney(item.unitPrice)}
                    </td>
                    <td className="px-2 py-1">
                      <span className="block text-center">{item.containerType || containerQuery.data?.[item.testId] || "—"}</span>
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
