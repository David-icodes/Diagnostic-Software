"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  HandCoins,
  Loader2,
  RotateCcw,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BillActionBar } from "@/components/billing/bill-action-bar";
import { LabBillPlaceholder } from "@/components/billing/lab-bill-placeholder";
import { collectLabDue, fetchLabBill, fetchDueBills, type BillListResult, type DueBillsParams } from "@/services/billing";
import { cn, formatDate, formatMoney } from "@/lib/utils";
import { invalidateRoots, queryKeys } from "@/lib/query-keys";
import { PAYMENT_MODES, type PaymentMode } from "@/types/billing";
import type { BillPatient, LabBill } from "@/types/billing";

type DuesMode = "days" | "criteria" | "bill";

function todayInput(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function toNumber(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function paymentModeLabel(mode: PaymentMode): string {
  return mode
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function toPatient(patientId: string | BillPatient | undefined): BillPatient | null {
  if (!patientId || typeof patientId === "string") return null;
  return patientId;
}

const MODE_OPTIONS: { value: DuesMode; label: string }[] = [
  { value: "days", label: "To days Dues" },
  { value: "criteria", label: "Criteria" },
  { value: "bill", label: "Bill No" },
];

export function CollectLabDues({ billId = "" }: { billId?: string }) {
  const context = useQuery({
    queryKey: [...queryKeys.labBills, "due-context", billId],
    queryFn: () => fetchLabBill(billId),
    enabled: Boolean(billId),
  });
  if (billId && context.isPending) return <p role="status">Loading the selected bill…</p>;
  if (billId && context.isError) return <p role="alert">{context.error.message}</p>;
  return <DuesForm key={billId} initialBill={billId ? context.data : undefined} />;
}

function DuesForm({ initialBill }: { initialBill?: LabBill }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<DuesMode>(initialBill ? "bill" : "days");
  const [fromDate, setFromDate] = useState(todayInput);
  const [toDate, setToDate] = useState(todayInput);
  const [patientId, setPatientId] = useState("");
  const [patientName, setPatientName] = useState("");
  const [billNumber, setBillNumber] = useState(initialBill?.billNumber ?? "");

  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<BillListResult | null>(initialBill ? {
    data: [initialBill], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  } : null);
  const [searchParams, setSearchParams] = useState<DueBillsParams>(initialBill ? { billNumber: initialBill.billNumber } : {});

  const [selectedBill, setSelectedBill] = useState<LabBill | null>(initialBill ?? null);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash");
  const [comments, setComments] = useState("");
  const [discountInput, setDiscountInput] = useState("");
  const [payingInput, setPayingInput] = useState("");
  const [showItems, setShowItems] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const searchMutation = useMutation({
    mutationFn: (params: DueBillsParams) => fetchDueBills(params),
    onSuccess: (result) => {
      setResults(result);
      setSearchError(null);
    },
    onError: (error: Error) => {
      setResults(null);
      setSearchError(error.message || "Failed to search due bills.");
    },
  });

  const collectMutation = useMutation({
    mutationFn: (input: { billId: string; amount: number; discountAmount: number }) =>
      collectLabDue(input.billId, {
        amount: input.amount,
        discountAmount: input.discountAmount,
        paymentMode,
        comments: comments.trim() || undefined,
      }),
    onSuccess: (updated, input) => {
      setSelectedBill(updated);
      setConfirmOpen(false);
      setPayingInput("");
      setDiscountInput("");
      setSuccessMessage(
        `₹${formatMoney(input.amount)} collected — new balance ${
          updated.dueAmount > 0
            ? `₹${formatMoney(updated.dueAmount)}`
            : "nil (fully paid)"
        }.`,
      );
      searchMutation.mutate({ ...searchParams });
      // A payment changes the bill balance and the dashboard due/summary reads.
      void invalidateRoots(
        queryClient,
        queryKeys.labBills,
        queryKeys.dashboard,
      );
    },
    onError: (error: Error) => {
      setConfirmOpen(false);
      setActionError(error.message || "Failed to record the collection.");
    },
  });

  const handleModeChange = (next: DuesMode) => {
    setMode(next);
    setSearchError(null);
    setResults(null);
    setSelectedBill(null);
    setDiscountInput("");
    setPayingInput("");
    setActionError(null);
    setSuccessMessage(null);
    if (next === "days") {
      setFromDate(todayInput());
      setToDate(todayInput());
    }
  };

  const runSearch = (nextPage = 1) => {
    setSuccessMessage(null);
    setActionError(null);
    setSelectedBill(null);
    setDiscountInput("");
    setPayingInput("");

    const params: DueBillsParams = { page: nextPage, limit: 20 };
    if (mode === "bill") {
      const trimmed = billNumber.trim();
      if (!trimmed) {
        setSearchError("Enter a bill number to search.");
        return;
      }
      params.billNumber = trimmed;
    } else {
      if (mode === "days") {
        params.fromDate = fromDate;
        params.toDate = toDate;
      } else {
        if (fromDate) params.fromDate = fromDate;
        if (toDate) params.toDate = toDate;
      }
      const pId = patientId.trim();
      const pName = patientName.trim();
      if (pId) params.patientId = pId;
      if (pName) params.patientName = pName;
    }

    setSearchParams(params);
    searchMutation.mutate(params);
  };

  const handleClearFilters = () => {
    setBillNumber("");
    setPatientId("");
    setPatientName("");
    setFromDate(mode === "days" || mode === "criteria" ? todayInput() : fromDate);
    setToDate(mode === "days" || mode === "criteria" ? todayInput() : toDate);
    setSearchError(null);
    setResults(null);
    setSelectedBill(null);
    setDiscountInput("");
    setPayingInput("");
    setActionError(null);
    setSuccessMessage(null);
  };

  const currentBalance = selectedBill ? Math.max(0, selectedBill.dueAmount) : 0;
  const parsedDiscount = toNumber(discountInput);
  const discount = Math.max(
    0,
    parsedDiscount === null ? 0 : parsedDiscount,
  );
  const payable = selectedBill
    ? round2(Math.max(0, currentBalance - discount))
    : 0;
  const parsedPaying = toNumber(payingInput);
  const payingValue = Math.max(0, parsedPaying === null ? 0 : parsedPaying);
  const netAmount = selectedBill
    ? round2(Math.max(0, selectedBill.netAmount - discount))
    : 0;
  const balanceAmount = selectedBill
    ? round2(Math.max(0, netAmount - selectedBill.paidAmount - payingValue))
    : 0;

  const discountTooHigh =
    selectedBill !== null && parsedDiscount !== null && discount > currentBalance;
  const payingValid =
    selectedBill !== null &&
    parsedPaying !== null &&
    parsedPaying > 0 &&
    parsedPaying <= payable &&
    !discountTooHigh;

  const handleSubmit = () => {
    if (!selectedBill) {
      setActionError("Select a bill to record payment.");
      return;
    }
    if (selectedBill.status === "cancelled") {
      setActionError("This bill has been cancelled and cannot receive payment.");
      return;
    }
    if (currentBalance <= 0) {
      setActionError("This bill has no outstanding balance.");
      return;
    }
    if (parsedDiscount === null || discount < 0) {
      setActionError("Enter a valid discount amount.");
      return;
    }
    if (discountTooHigh) {
      setActionError(
        `Discount cannot exceed the outstanding balance of ₹${formatMoney(currentBalance)}.`,
      );
      return;
    }
    if (parsedPaying === null || parsedPaying <= 0) {
      setActionError("Enter an amount greater than 0 to pay.");
      return;
    }
    if (parsedPaying > payable) {
      setActionError(
        `Amount cannot exceed the payable balance of ₹${formatMoney(payable)}.`,
      );
      return;
    }
    setActionError(null);
    setConfirmOpen(true);
  };

  const rows = results?.data ?? [];
  const totalBalance = rows.reduce((sum, bill) => sum + Math.max(0, bill.dueAmount), 0);
  const selectedPatient = toPatient(selectedBill?.patientId);

  return (
    <div className="lis-dues space-y-3">
      <header className="rounded-md border border-border/80 bg-white shadow-sm">
        <div className="flex items-start justify-between gap-2 px-4 py-2.5 md:px-5">
          <div className="flex items-start gap-2">
            <HandCoins className="mt-0.5 size-5 text-primary" />
            <div>
              <h1 className="font-heading text-base font-medium text-slate-800">
                Investigations Collect Dues
              </h1>
              <p className="text-[13px] text-muted-foreground">
                Find bills with outstanding balances and record their collection
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-border/80 px-4 py-2.5 md:px-5">
          <fieldset>
            <legend className="sr-only">Due search filter</legend>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {MODE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-700"
                >
                  <input
                    type="radio"
                    name="duesFilter"
                    value={option.value}
                    checked={mode === option.value}
                    onChange={() => handleModeChange(option.value)}
                    className="size-3.5 accent-primary"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="fromDate">Bill Date From</Label>
              <Input
                id="fromDate"
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                className="h-8"
                disabled={mode === "bill"}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="toDate">Bill Date To</Label>
              <Input
                id="toDate"
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                className="h-8"
                disabled={mode === "bill"}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="duesPatientId">Patient Id</Label>
              <Input
                id="duesPatientId"
                type="text"
                value={patientId}
                onChange={(event) => setPatientId(event.target.value)}
                className="h-8 font-mono uppercase"
                disabled={mode === "bill"}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="duesPatientName">Patient Name</Label>
              <Input
                id="duesPatientName"
                type="text"
                value={patientName}
                onChange={(event) => setPatientName(event.target.value)}
                className="h-8"
                disabled={mode === "bill"}
              />
            </div>
          </div>

          {mode === "bill" && (
            <div className="max-w-sm space-y-1">
              <Label htmlFor="duesBillNumber">Bill No</Label>
              <Input
                id="duesBillNumber"
                type="text"
                value={billNumber}
                onChange={(event) => setBillNumber(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") runSearch(1);
                }}
                className="h-8 font-mono uppercase"
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={() => runSearch(1)}
              disabled={searchMutation.isPending}
              className="h-8"
            >
              {searchMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search />
              )}
              Search
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleClearFilters}
              disabled={searchMutation.isPending}
              className="h-8"
            >
              <RotateCcw />
              Clear
            </Button>
          </div>
        </div>
      </header>

      {successMessage && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {(actionError || searchError) && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{actionError ?? searchError}</span>
        </div>
      )}

      <Card className="border-border shadow-sm">
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Due Bills
            </h3>
            {results && (
              <span className="text-xs text-muted-foreground">
                {results.pagination.total} bill{results.pagination.total === 1 ? "" : "s"}
                {rows.length > 0
                  ? ` · Total balance ₹${formatMoney(totalBalance)}`
                  : ""}
              </span>
            )}
          </div>
          <div className="max-h-[min(240px,44vh)] overflow-auto border-t border-border">
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-1.5">Bill No</th>
                  <th className="px-2 py-1.5">Patient Id</th>
                  <th className="px-2 py-1.5">Pat Name</th>
                  <th className="px-2 py-1.5">OP/IP/ER/GP ID</th>
                  <th className="px-2 py-1.5 text-right">Total Bill Amnt</th>
                  <th className="px-2 py-1.5 text-right">Paid Amnt</th>
                  <th className="px-2 py-1.5 text-right">Bal Amnt</th>
                  <th className="px-2 py-1.5">Bill Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr className="border-t border-border">
                    <td
                      colSpan={8}
                      className="px-2 py-6 text-center text-xs text-muted-foreground"
                    >
                      No Records To Display
                    </td>
                  </tr>
                ) : (
                  rows.map((bill) => {
                    const rowPatient = toPatient(bill.patientId);
                    const selected = selectedBill?.id === bill.id;
                    return (
                      <tr
                        key={bill.id}
                        aria-selected={selected}
                        className={cn(
                          "cursor-pointer border-l-4 border-t border-border transition-colors",
                          selected
                            ? "border-l-primary bg-blue-50"
                            : "border-l-transparent hover:bg-slate-50",
                        )}
                        onClick={() => {
                          setSelectedBill(bill);
                          setDiscountInput("");
                          setPayingInput("");
                          setActionError(null);
                          setSuccessMessage(null);
                        }}
                      >
                        <td className="px-2 py-1.5 font-mono font-medium text-slate-800">
                          {bill.billNumber}
                        </td>
                        <td className="px-2 py-1.5 font-mono text-slate-700">
                          {rowPatient?.patientId ?? "—"}
                        </td>
                        <td className="px-2 py-1.5 font-medium text-slate-800">
                          {rowPatient?.fullName ?? "—"}
                        </td>
                        <td className="px-2 py-1.5 text-slate-700">
                          {bill.patientType.toUpperCase()}
                        </td>
                        <td className="px-2 py-1.5 text-right text-slate-700">
                          {formatMoney(bill.totalAmount)}
                        </td>
                        <td className="px-2 py-1.5 text-right text-emerald-600">
                          {formatMoney(bill.paidAmount)}
                        </td>
                        <td className="px-2 py-1.5 text-right font-medium text-amber-600">
                          {formatMoney(bill.dueAmount)}
                        </td>
                        <td className="px-2 py-1.5 text-slate-700">
                          {bill.createdAt ? formatDate(bill.createdAt) : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {results && results.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-3 py-2">
              <span className="text-xs text-muted-foreground">
                Page {results.pagination.page} of {results.pagination.totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={results.pagination.page <= 1 || searchMutation.isPending}
                  onClick={() => runSearch(results.pagination.page - 1)}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={
                    results.pagination.page >= results.pagination.totalPages ||
                    searchMutation.isPending
                  }
                  onClick={() => runSearch(results.pagination.page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {!selectedBill && <LabBillPlaceholder mode="dues" />}
      {selectedBill && (
        <section className="rounded-md border border-border/80 bg-white shadow-sm">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
            <div className="flex items-center gap-2">
              <HandCoins className="size-4 text-primary" />
              <h2 className="font-heading text-[13px] font-semibold text-slate-800">
                Collect Payment
              </h2>
              <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
                {selectedBill.status.toUpperCase()}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="font-medium text-slate-800">
                {selectedPatient?.fullName ?? "—"}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {selectedPatient?.patientId ?? ""}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {selectedBill.billNumber}
              </span>
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">
                Outstanding ₹{formatMoney(currentBalance)}
              </span>
            </div>
          </header>

          <div className="border-t border-border">
            <button
              type="button"
              onClick={() => setShowItems((current) => !current)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
              aria-expanded={showItems}
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Bill Items
              </span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                {selectedBill.items.length} item
                {selectedBill.items.length === 1 ? "" : "s"}
                {showItems ? (
                  <ChevronUp className="size-4" />
                ) : (
                  <ChevronDown className="size-4" />
                )}
              </span>
            </button>
            {showItems && (
              <div className="max-h-[150px] overflow-auto border-t border-border">
                <table className="min-w-full text-xs">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-2 py-1.5">Name</th>
                      <th className="px-2 py-1.5 text-right">Amount</th>
                      <th className="px-2 py-1.5 text-right">Qty</th>
                      <th className="px-2 py-1.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedBill.items.map((item) => (
                      <tr key={item.testId} className="border-t border-border">
                        <td className="px-2 py-1.5">
                          <p className="text-xs font-medium text-slate-800">{item.testName}</p>
                          <p className="font-mono text-[11px] text-muted-foreground">
                            {item.testCode} × {item.quantity}
                          </p>
                        </td>
                        <td className="px-2 py-1.5 text-right text-slate-700">
                          {formatMoney(item.unitPrice)}
                        </td>
                        <td className="px-2 py-1.5 text-right text-slate-700">
                          {item.quantity}
                        </td>
                        <td className="px-2 py-1.5 text-right font-semibold text-slate-800">
                          {formatMoney(item.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {currentBalance <= 0 && (
              <div className="border-t border-border bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                <BadgeCheck className="mr-1 inline size-3.5" />
                Fully Paid — no outstanding balance.
              </div>
            )}
          </div>

          <div className="lis-dues-payment grid grid-cols-1 items-start gap-3 p-3 lg:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="duePaymentMode">Payment Mode</Label>
              <Select
                id="duePaymentMode"
                value={paymentMode}
                onChange={(event) =>
                  setPaymentMode(event.target.value as PaymentMode)
                }
                disabled={currentBalance <= 0 || collectMutation.isPending}
              >
                {PAYMENT_MODES.map((modeOption) => (
                  <option key={modeOption} value={modeOption}>
                    {paymentModeLabel(modeOption)}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="dueComments">Comments</Label>
              <Textarea
                id="dueComments"
                rows={4}
                value={comments}
                onChange={(event) => setComments(event.target.value)}
                maxLength={500}
                disabled={currentBalance <= 0 || collectMutation.isPending}
              />
              <p className="text-xs text-muted-foreground">
                Optional remark recorded against this collection.
              </p>
            </div>

            <div className="space-y-1.5 rounded-md border border-border/80 p-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Amount Summary
              </h3>
              <div className="flex items-center justify-between gap-2">
                <Label>Total Amount</Label>
                <span className="text-sm font-medium text-slate-800">
                  ₹{formatMoney(selectedBill.totalAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="dueDiscount">Enter Discount (Rs.)</Label>
                <Input
                  id="dueDiscount"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={discountInput}
                  onChange={(event) => setDiscountInput(event.target.value)}
                  className="h-8 w-28 text-right"
                  disabled={currentBalance <= 0 || collectMutation.isPending}
                  aria-invalid={Boolean(discountTooHigh)}
                />
              </div>
              {discountTooHigh && (
                <p className="text-right text-xs text-destructive">
                  Cannot exceed balance of ₹{formatMoney(currentBalance)}
                </p>
              )}
              <div className="flex items-center justify-between gap-2">
                <Label>Net Amount</Label>
                <span className="text-sm font-semibold text-slate-800">
                  ₹{formatMoney(netAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="duePayingAmount">Paying Amount</Label>
                <Input
                  id="duePayingAmount"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={payingInput}
                  onChange={(event) => setPayingInput(event.target.value)}
                  className="h-8 w-28 text-right"
                  disabled={currentBalance <= 0 || collectMutation.isPending}
                  aria-invalid={
                    selectedBill !== null &&
                    payingInput !== "" &&
                    !payingValid &&
                    !discountTooHigh
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-border pt-1.5">
                <Label className="text-slate-700">Balance Amount</Label>
                <span
                  className={cn(
                    "text-base font-semibold",
                    balanceAmount > 0 ? "text-amber-600" : "text-emerald-600",
                  )}
                >
                  ₹{formatMoney(balanceAmount)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Due ₹{formatMoney(currentBalance)} · Payable after discount ₹
                {formatMoney(payable)}
              </p>
            </div>
          </div>

        </section>
      )}

      <BillActionBar
        submitLabel="Submit Payment"
        submitIcon={<HandCoins />}
        submitting={collectMutation.isPending}
        submitDisabled={!selectedBill || currentBalance <= 0}
        onSubmit={handleSubmit}
        onClear={handleClearFilters}
      />

      <Dialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirm Due Collection"
        description="Record this payment against the selected bill?"
        size="md"
      >
        {selectedBill && parsedPaying !== null && (
          <div className="space-y-3">
            <div className="divide-y divide-border rounded-lg border border-border text-sm">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-muted-foreground">Bill Number</span>
                <span className="font-mono font-medium text-slate-800">
                  {selectedBill.billNumber}
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-muted-foreground">Patient</span>
                <span className="font-medium text-slate-800">
                  {selectedPatient?.fullName ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-muted-foreground">Current Balance</span>
                <span className="font-semibold text-amber-600">
                  ₹{formatMoney(currentBalance)}
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-muted-foreground">Discount</span>
                <span className="font-medium text-slate-800">
                  ₹{formatMoney(discount)}
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-muted-foreground">Amount to Collect</span>
                <span className="font-semibold text-slate-900">
                  ₹{formatMoney(parsedPaying)} ({paymentModeLabel(paymentMode)})
                </span>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmOpen(false)}
                disabled={collectMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() =>
                  collectMutation.mutate({
                    billId: selectedBill.id,
                    amount: parsedPaying,
                    discountAmount: discount,
                  })
                }
                disabled={collectMutation.isPending}
              >
                {collectMutation.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Confirm Payment
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
