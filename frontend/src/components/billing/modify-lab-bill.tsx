"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  FilePen,
  Loader2,
  Maximize2,
  Minimize2,
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
import { TestSelector, type OutsideChoice, type SelectedTestItem } from "@/components/billing/test-selector";
import { LabBillPlaceholder } from "@/components/billing/lab-bill-placeholder";
import { fetchLabBills, modifyLabBill } from "@/services/billing";
import { cn, formatDate, formatMoney } from "@/lib/utils";
import { invalidateRoots, queryKeys } from "@/lib/query-keys";
import { ApiError } from "@/lib/api";
import { PAYMENT_MODES, type PaymentMode } from "@/types/billing";
import type { BillPatient, BillDoctor, LabBill, LabTest } from "@/types/billing";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function toPatient(patientId: string | BillPatient | undefined): BillPatient | null {
  if (!patientId || typeof patientId === "string") return null;
  return patientId;
}

function toDoctor(
  referringDoctorId: string | BillDoctor | undefined,
): BillDoctor | null {
  if (!referringDoctorId || typeof referringDoctorId === "string") return null;
  return referringDoctorId;
}

function paymentModeLabel(mode: PaymentMode): string {
  return mode
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function resolveBillPrice(
  test: LabTest,
  patientType: LabBill["patientType"],
): number {
  if (patientType === "ip") return test.priceIp ?? test.price;
  if (patientType === "emergency") return test.priceEr ?? test.price;
  return test.price;
}

type EditableItem = SelectedTestItem;

export function ModifyLabBill() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(false);

  const [bill, setBill] = useState<LabBill | null>(null);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [discountPercent, setDiscountPercent] = useState("0");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash");
  const [comments, setComments] = useState("");
  const [displayOnBill, setDisplayOnBill] = useState(false);

  const [pendingBill, setPendingBill] = useState<LabBill | null>(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const billsQuery = useQuery({
    queryKey: [...queryKeys.labBills, "modify-list", search],
    queryFn: () => fetchLabBills({ limit: 200, search: search || undefined }),
    placeholderData: (previous) => previous,
  });

  const billRows = billsQuery.data?.data ?? [];

  const editable = Boolean(
    bill &&
      bill.status !== "cancelled",
  );
  const lockReason = !bill
    ? ""
    : bill.status === "cancelled"
      ? "This bill has been cancelled and cannot be modified."
      : "";

  const totals = (() => {
    const totalAmount = round2(
      items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    );
    const params = Number(discountPercent);
    const discountCapped =
      Number.isFinite(params) ? Math.min(100, Math.max(0, params)) : 0;
    const discountAmount = round2((totalAmount * discountCapped) / 100);
    const netAmount = round2(Math.max(0, totalAmount - discountAmount));
    const paidAmount = round2(Math.max(0, bill?.paidAmount ?? 0));
    const balanceAmount = round2(Math.max(0, netAmount - paidAmount));
    const creditAmount = round2(Math.max(0, paidAmount - netAmount));
    return { totalAmount, discountAmount, netAmount, paidAmount, balanceAmount, creditAmount };
  })();


  const isDirty = useMemo(() => {
    if (!bill) return false;
    if (items.length !== bill.items.length) return true;
    for (let index = 0; index < items.length; index += 1) {
      const left = items[index];
      const right = bill.items[index];
      if (!right) return true;
      if (left.testId !== right.testId || left.quantity !== right.quantity || (left.outsideLabId ?? null) !== (right.outsideLabId ?? null) || Boolean(left.out) !== Boolean(right.outsideLabId)) {
        return true;
      }
    }
    if (Number(discountPercent) !== Number(bill.discountPercent)) return true;
    if (paymentMode !== bill.paymentMode) return true;
    if (comments !== (bill.comments ?? "")) return true;
    if (displayOnBill !== Boolean(bill.displayComments)) return true;
    return false;
  }, [bill, items, discountPercent, paymentMode, comments, displayOnBill]);


  const applyBillSelection = (candidate: LabBill) => {
    setBill(candidate);
    setItems(
      candidate.items.map((item) => ({
        testId: item.testId,
        testCode: item.testCode,
        testName: item.testName,
        departmentName: item.departmentName,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        out: Boolean(item.outsideLabId),
        outsideLabId: item.outsideLabId,
        outsideLabName: item.outsideLabName,
      })),
    );
    setDiscountPercent(String(candidate.discountPercent));
    setPaymentMode(candidate.paymentMode);
    setComments(candidate.comments ?? "");
    setDisplayOnBill(Boolean(candidate.displayComments));
  };

  const requestSelectBill = (candidate: LabBill) => {
    setFormError(null);
    setSuccessMessage(null);
    if (bill && isDirty && candidate.id !== bill.id) {
      setPendingBill(candidate);
      setClearConfirmOpen(true);
      return;
    }
    applyBillSelection(candidate);
  };

  const handleAddTest = (test: LabTest, departmentName: string, outside: OutsideChoice = {}) => {
    if (!bill || !editable) return;
    const unitPrice = resolveBillPrice(test, bill.patientType);
    setItems((current) => {
      if (current.some((item) => item.testId === test.id)) return current;
      return [
        ...current,
        {
          testId: test.id,
          testCode: test.testCode,
          testName: test.testName,
          departmentName,
          unitPrice,
          quantity: 1,
          containerType: test.containerType,
          ...outside,
        },
      ];
    });
  };

  const handleRemoveItem = (testId: string) => {
    setItems((current) => current.filter((item) => item.testId !== testId));
  };

  const handleQuantityChange = (testId: string, quantity: number) => {
    setItems((current) =>
      current.map((item) =>
        item.testId === testId
          ? { ...item, quantity: Math.max(1, Math.min(100, quantity)) }
          : item,
      ),
    );
  };

  const resetForm = () => {
    setSearchInput("");
    setSearch("");
    setBill(null);
    setItems([]);
    setDiscountPercent("0");
    setPaymentMode("cash");
    setComments("");
    setDisplayOnBill(false);
    setFormError(null);
    setSuccessMessage(null);
  };

  const handleClear = () => {
    if (isDirty) {
      setPendingBill(null);
      setClearConfirmOpen(true);
      return;
    }
    resetForm();
  };

  const confirmDiscard = () => {
    const next = pendingBill;
    setPendingBill(null);
    setClearConfirmOpen(false);
    if (next) {
      applyBillSelection(next);
    } else {
      resetForm();
    }
  };

  const modifyMutation = useMutation({
    mutationFn: () => {
      if (!bill) {
        throw new ApiError("Select a bill to modify.");
      }
      if (!editable) {
        throw new ApiError(lockReason || "This bill cannot be modified.");
      }
      if (items.length === 0) {
        throw new ApiError("Add at least one test to the bill.");
      }
      if (items.some((item) => (item.out ?? Boolean(item.outsideLabId)) && !item.outsideLabId)) {
        throw new ApiError("Select an outside lab for every test marked Out.");
      }
      return modifyLabBill(bill.id, {
        items: items.map((item) => ({ testId: item.testId, quantity: item.quantity, out: Boolean(item.out ?? item.outsideLabId), outsideLabId: item.outsideLabId ?? null })),
        discountPercent: Number(discountPercent),
        paymentMode,
        comments: comments.trim() || undefined,
        displayComments: displayOnBill ? comments.trim() || undefined : undefined,
      });
    },
    onSuccess: (updated) => {
      setBill(updated);
      setFormError(null);
      setSuccessMessage(`Bill ${updated.billNumber} updated successfully.`);
      // Items, totals and dues changed: refresh the bill views, the sample
      // lists derived from them and the dashboard counters.
      void invalidateRoots(
        queryClient,
        queryKeys.labBills,
        queryKeys.labSamples,
        queryKeys.dashboard,
      );
    },
    onError: (error: Error) => {
      setFormError(error.message || "Failed to update the bill.");
    },
  });

  const lockEdits = !editable || modifyMutation.isPending;

  const patient = toPatient(bill?.patientId);
  const doctor = bill
    ? toDoctor(bill.referringDoctorId)?.name ?? bill.doctorName
    : null;



  return (
    <div className="lis-modify space-y-3">
      <header className="rounded-md border border-border/80 bg-white shadow-sm">
        <div className="flex min-h-[58px] flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <FilePen className="size-4 text-primary" />
            <div>
              <h1 className="font-heading text-[18px] font-medium leading-tight text-slate-800">
                Modify Lab Bill
              </h1>
              <p className="text-[13px] leading-snug text-muted-foreground">
                Select a bill, adjust tests and finalize the changes
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input
              id="modifyBillSearch"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") setSearch(searchInput.trim());
              }}
              className="h-[34px] w-64 text-xs"
              aria-label="Search bills"
            />
            <Button
              type="button"
              onClick={() => setSearch(searchInput.trim())}
              disabled={billsQuery.isFetching}
              className="h-[34px] px-2.5"
            >
              {billsQuery.isFetching ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search />
              )}
              Search
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              title={expanded ? "Exit fullscreen" : "Fullscreen"}
              onClick={() => setExpanded((current) => !current)}
              className="h-[34px] w-[34px]"
            >
              {expanded ? (
                <Minimize2 className="size-4" />
              ) : (
                <Maximize2 className="size-4" />
              )}
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

      {formError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      <Card className="border-border shadow-sm">
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-2.5 py-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Existing Bills
            </h3>
            <Badge variant="secondary">
              {billsQuery.data ? billsQuery.data.pagination.total : "…"}
            </Badge>
          </div>
          <div className="max-h-[min(180px,38vh)] overflow-auto border-y border-border">
            <table className="lis-modify-bill-table min-w-full text-xs">
              <thead className="sticky top-0 z-[1]">
                <tr className="bg-slate-100 text-left font-semibold uppercase tracking-wide text-slate-500">
                  <th className="h-[30px] px-2 py-1">Select</th>
                  <th className="h-[30px] px-2 py-1">Bill No</th>
                  <th className="h-[30px] px-2 py-1">Bill Date</th>
                  <th className="h-[30px] px-2 py-1">Pat Id</th>
                  <th className="h-[30px] px-2 py-1">Ref Id</th>
                  <th className="h-[30px] px-2 py-1">Pat Name</th>
                  <th className="h-[30px] px-2 py-1">Gender</th>
                  <th className="h-[30px] px-2 py-1 text-right">Age</th>
                  <th className="h-[30px] px-2 py-1">Mobile No</th>
                  <th className="h-[30px] px-2 py-1">Pat Type</th>
                </tr>
              </thead>
              <tbody>
                {billsQuery.isLoading ? (
                  <tr className="border-t border-border">
                    <td colSpan={10} className="px-2 py-4 text-center text-xs text-muted-foreground">
                      Loading bills…
                    </td>
                  </tr>
                ) : billRows.length === 0 ? (
                  <tr className="border-t border-border">
                    <td colSpan={10} className="px-2 py-4 text-center text-xs text-muted-foreground">
                      No bills found
                    </td>
                  </tr>
                ) : (
                  billRows.map((candidate) => {
                    const rowPatient = toPatient(candidate.patientId);
                    const rowDoctor = toDoctor(candidate.referringDoctorId);
                    const selected = bill?.id === candidate.id;
                    return (
                      <tr
                        key={candidate.id}
                        aria-selected={selected}
                        onClick={() => requestSelectBill(candidate)}
                        className={cn(
                          "cursor-pointer border-l-4 border-t border-border transition-colors",
                          selected
                            ? "border-l-primary bg-blue-50 font-medium"
                            : "border-l-transparent hover:bg-slate-50",
                          candidate.status === "cancelled" && "opacity-60",
                        )}
                      >
                        <td className="px-2 py-[5px]">
                          <input
                            type="radio"
                            name="modifyBillSelect"
                            checked={selected}
                            readOnly
                            className="size-3.5 accent-primary"
                            aria-label={`Select bill ${candidate.billNumber}`}
                          />
                        </td>
                        <td className="px-2 py-[5px] font-mono font-medium text-slate-800">
                          {candidate.billNumber}
                        </td>
                        <td className="px-2 py-[5px] text-slate-700">
                          {candidate.createdAt ? formatDate(candidate.createdAt) : "—"}
                        </td>
                        <td className="px-2 py-[5px] font-mono text-slate-700">
                          {rowPatient?.patientId ?? "—"}
                        </td>
                        <td className="px-2 py-[5px] text-slate-700">
                          {rowDoctor?.name ?? candidate.doctorName ?? "—"}
                        </td>
                        <td className="px-2 py-[5px] text-slate-800">
                          {rowPatient?.fullName ?? "—"}
                        </td>
                        <td className="px-2 py-[5px] text-slate-700">
                          {rowPatient?.gender ?? "—"}
                        </td>
                        <td className="px-2 py-[5px] text-right text-slate-700">
                          {rowPatient?.age ?? "—"}
                        </td>
                        <td className="px-2 py-[5px] text-slate-700">
                          {rowPatient?.mobile ?? "—"}
                        </td>
                        <td className="px-2 py-[5px] text-slate-700">
                          {candidate.patientType.toUpperCase()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {!bill && <LabBillPlaceholder mode="modify" />}
      {bill && (
        <section
          className={cn(
            "rounded-md border border-border/80 bg-white shadow-sm",
            expanded && "ring-2 ring-primary/30",
          )}
        >
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <FilePen className="size-3.5 text-primary" />
              <h2 className="font-heading text-[13px] font-semibold text-slate-800">
                Modify Bill
              </h2>
              <span className="text-[13px] font-medium text-slate-800">
                {patient?.fullName ?? "—"}
              </span>
              <Badge variant="secondary">{patient?.patientId ?? bill.billNumber}</Badge>
              <span className="font-mono text-[11px] text-muted-foreground">
                {bill.billNumber}
              </span>
              <Badge
                variant={bill.status === "cancelled" ? "destructive" : "outline"}
                className={
                  bill.status !== "cancelled"
                    ? "border-primary/20 bg-primary/5 text-primary"
                    : undefined
                }
              >
                {bill.status.toUpperCase()}
              </Badge>
              {isDirty && (
                <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
                  Unsaved changes
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {bill.patientType.toUpperCase()} ·{" "}
              {doctor ? doctor : "No referring doctor"} · Bill date{" "}
              {bill.createdAt ? formatDate(bill.createdAt) : "—"}
            </p>
          </header>

          {!editable && (
            <div
              role="alert"
              className="flex items-start gap-2 border-b border-border bg-amber-50 px-3 py-1.5 text-xs text-amber-700"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{lockReason}</span>
            </div>
          )}

          <div className="space-y-3 p-2.5">
            <TestSelector key={bill.id} items={items} onAdd={handleAddTest}
              onRemove={handleRemoveItem} onQuantityChange={handleQuantityChange}
              disabled={lockEdits} selectedTitle="Existed Lab Tests" showSerial={false} />

            <div className="lis-modify-payment grid grid-cols-1 items-start gap-3 lg:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="modifyPaymentMode" className="text-xs">
                  Payment Mode
                </Label>
                <Select
                  id="modifyPaymentMode"
                  value={paymentMode}
                  onChange={(event) =>
                    setPaymentMode(event.target.value as PaymentMode)
                  }
                  disabled={lockEdits}
                  className="h-8 text-xs"
                >
                  {PAYMENT_MODES.map((modeOption) => (
                    <option key={modeOption} value={modeOption}>
                      {paymentModeLabel(modeOption)}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="modifyComments" className="text-xs">
                    Comments
                  </Label>
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={displayOnBill}
                      onChange={(event) => setDisplayOnBill(event.target.checked)}
                      disabled={lockEdits}
                      className="size-3.5 accent-primary"
                    />
                    Display comments in Bill
                  </label>
                </div>
                <Textarea
                  id="modifyComments"
                  rows={2}
                  value={comments}
                  onChange={(event) => setComments(event.target.value)}
                  maxLength={500}
                  disabled={lockEdits}
                  className="h-[52px] resize-none text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  Remark shown on the printed bill when enabled.
                </p>
              </div>

              <div className="space-y-1.5 rounded-md border border-border/80 p-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Amount Summary
                </h3>
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs">Total Amount</Label>
                  <span className="text-sm font-medium text-slate-800">
                    ₹{formatMoney(totals.totalAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="modifyDiscountPercent" className="text-xs">
                    Enter Discount : %
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      id="modifyDiscountPercent"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={100}
                      step="0.01"
                      value={discountPercent}
                      onChange={(event) => setDiscountPercent(event.target.value)}
                      disabled={lockEdits}
                      className="h-8 w-20 text-right text-xs"
                    />
                    <span className="w-8 text-right text-xs text-muted-foreground">
                      ₹{formatMoney(totals.discountAmount)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs">Net Amount</Label>
                  <span className="text-sm font-semibold text-slate-900">
                    ₹{formatMoney(totals.netAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs">Paid Amount</Label>
                  <span className="text-sm font-medium text-emerald-600">
                    ₹{formatMoney(totals.paidAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-border pt-1.5">
                  <Label className="text-xs text-slate-700">Balance Amount</Label>
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      totals.balanceAmount > 0
                          ? "text-amber-600"
                          : "text-emerald-600",
                    )}
                  >
                    ₹{formatMoney(totals.balanceAmount)}
                  </span>
                </div>
                {totals.creditAmount > 0 && (
                  <p role="status" className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1.5 text-xs text-blue-800">
                    Overpayment credit: ₹{formatMoney(totals.creditAmount)}. Recorded
                    payments remain unchanged. No refund has been issued.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      <BillActionBar
        submitLabel="Submit"
        submitIcon={<FilePen />}
        submitting={modifyMutation.isPending}
        submitDisabled={!bill || !editable}
        onSubmit={() => {
          setFormError(null);
          void modifyMutation.mutate();
        }}
        onClear={handleClear}
        compact
      />

      <Dialog
        open={clearConfirmOpen}
        onOpenChange={setClearConfirmOpen}
        title="Discard unsaved changes?"
        description={
          pendingBill
            ? "Selecting another bill will discard your current unsaved modifications."
            : "Your unsaved modifications will be lost if you continue."
        }
        size="md"
      >
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setClearConfirmOpen(false);
              setPendingBill(null);
            }}
          >
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={confirmDiscard}>
            Discard
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
