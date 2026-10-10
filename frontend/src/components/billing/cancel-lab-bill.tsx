"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  BadgeCheck,
  CheckCircle2,
  Loader2,
  Search,
  ShieldX,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { BillPageHeader } from "@/components/billing/bill-page-header";
import { BillActionBar } from "@/components/billing/bill-action-bar";
import { cancelLabBill, fetchLabBillByBillNumber } from "@/services/billing";
import { formatDate, formatMoney } from "@/lib/utils";
import { invalidateRoots, queryKeys } from "@/lib/query-keys";
import type { BillPatient, LabBill } from "@/types/billing";

type LookupState = "idle" | "loading" | "found" | "empty" | "error";

function toPatient(patientId: string | BillPatient | undefined): BillPatient | null {
  if (!patientId || typeof patientId === "string") return null;
  return patientId;
}

function isNotFound(error: Error): boolean {
  return error.message.toLowerCase().includes("not found");
}

export function CancelLabBill() {
  const queryClient = useQueryClient();
  const [billNumber, setBillNumber] = useState("");
  const [lookupState, setLookupState] = useState<LookupState>("idle");
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [bill, setBill] = useState<LabBill | null>(null);
  const [remarks, setRemarks] = useState("");
  const [remarksError, setRemarksError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const lookupMutation = useMutation({
    mutationFn: (number: string) => fetchLabBillByBillNumber(number),
    onSuccess: (found) => {
      setBill(found);
      setLookupState("found");
      setLookupError(null);
      setSuccessMessage(null);
    },
    onError: (error: Error) => {
      setBill(null);
      setSuccessMessage(null);
      if (isNotFound(error)) {
        setLookupState("empty");
        setLookupError(null);
      } else {
        setLookupState("error");
        setLookupError(error.message || "Failed to look up the bill.");
      }
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) =>
      cancelLabBill(id, { cancellationRemarks: remarks.trim() }),
    onSuccess: (updated) => {
      setBill(updated);
      setConfirmOpen(false);
      setSuccessMessage(`Bill ${updated.billNumber} has been cancelled successfully.`);
      // A cancelled bill leaves the bill lists and the dashboard totals.
      void invalidateRoots(
        queryClient,
        queryKeys.labBills,
        queryKeys.dashboard,
      );
    },
    onError: (error: Error) => {
      setConfirmOpen(false);
      setSuccessMessage(null);
      setLookupError(error.message || "Failed to cancel the bill.");
    },
  });

  const handleShow = () => {
    const trimmed = billNumber.trim();
    if (!trimmed) {
      setLookupState("error");
      setLookupError("Enter a bill number to search.");
      return;
    }
    setSuccessMessage(null);
    setRemarksError(null);
    setLookupState("loading");
    lookupMutation.mutate(trimmed);
  };

  const handleClear = () => {
    setBillNumber("");
    setRemarks("");
    setRemarksError(null);
    setLookupError(null);
    setSuccessMessage(null);
    setBill(null);
    setLookupState("idle");
  };

  const handleCancelClick = () => {
    if (!remarks.trim() || remarks.trim().length < 3) {
      setRemarksError("Enter a reason for cancellation (minimum 3 characters).");
      return;
    }
    setRemarksError(null);
    setConfirmOpen(true);
  };

  const patient = bill ? toPatient(bill.patientId) : null;
  const isCancelled = bill?.status === "cancelled";
  const cancelDisabled = !bill || isCancelled || cancelMutation.isPending;

  return (
    <div className="lis-cancel space-y-3">
      <BillPageHeader
        icon={ShieldX}
        title="Cancel Lab Bill"
        subtitle="Look up a bill by number and cancel it with a reason"
        actions={
          <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
            <ShieldX className="size-3" />
            Billing
          </Badge>
        }
      />

      {successMessage && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {lookupError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{lookupError}</span>
        </div>
      )}

      <Card className="border-border shadow-sm">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-end justify-center gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="billNumber" className="text-xs">
                Enter Bill Number :
              </Label>
              <Input
                id="billNumber"
                type="text"

                value={billNumber}
                onChange={(event) => setBillNumber(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleShow();
                }}
                className="h-8 w-64 font-mono uppercase"
                disabled={lookupMutation.isPending}
              />
            </div>
            <Button
              type="button"
              onClick={handleShow}
              disabled={lookupMutation.isPending}
            >
              {lookupMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search />
              )}
              Show
            </Button>
          </div>
        </CardContent>
      </Card>

      {isCancelled && bill && (
        <div
          role="alert"
          className="flex flex-wrap items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800"
        >
          <BadgeCheck className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">This bill has already been cancelled.</p>
            <p className="mt-0.5 text-xs text-amber-700">
              Cancelled on {bill.cancelledAt ? formatDate(bill.cancelledAt) : "—"}
              {bill.cancellationRemarks
                ? ` · Reason: ${bill.cancellationRemarks}`
                : ""}
            </p>
          </div>
        </div>
      )}

      <Card className="border-border shadow-sm">
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Bill Information
            </h3>
            {bill && (
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">
                  {bill.billNumber}
                </span>
                <Badge
                  variant={isCancelled ? "destructive" : "outline"}
                  className={
                    isCancelled
                      ? undefined
                      : "border-primary/20 bg-primary/5 text-primary"
                  }
                >
                  {isCancelled ? "CANCELLED" : bill.status.toUpperCase()}
                </Badge>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-1.5">Bill No</th>
                  <th className="px-3 py-1.5">OP/IP/ER/GP ID</th>
                  <th className="px-3 py-1.5">Lab Test Name</th>
                  <th className="px-3 py-1.5 text-right">Test Amount</th>
                  <th className="px-3 py-1.5">Test Date</th>
                  <th className="px-3 py-1.5 text-right">Discount</th>
                  <th className="px-3 py-1.5 text-right">Net Amount</th>
                  <th className="px-3 py-1.5 text-right">Paid</th>
                  <th className="px-3 py-1.5 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {!bill || lookupState === "idle" || lookupState === "loading" || lookupState === "empty" ? (
                  <tr className="border-t border-border">
                    <td
                      colSpan={9}
                      className="px-3 py-6 text-center text-xs text-muted-foreground"
                    >
                      {lookupState === "loading" ? "Searching…" : "No bill found."}
                    </td>
                  </tr>
                ) : (
                  bill.items.map((item, index) => (
                    <tr key={item.testId + index} className="border-t border-border">
                      <td className="px-3 py-1.5 font-mono font-medium text-slate-800">
                        {bill.billNumber}
                      </td>
                      <td className="px-3 py-1.5 text-slate-700">
                        {bill.patientType.toUpperCase()} · {patient?.patientId ?? "—"}
                      </td>
                      <td className="px-3 py-1.5">
                        <p className="text-xs font-medium text-slate-800">{item.testName}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">
                          {item.testCode} × {item.quantity}
                        </p>
                      </td>
                      <td className="px-3 py-1.5 text-right text-slate-700">
                        ₹{formatMoney(item.total)}
                      </td>
                      <td className="px-3 py-1.5 text-slate-700">
                        {bill.createdAt ? formatDate(bill.createdAt) : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right text-slate-700">
                        {bill.discountAmount > 0
                          ? `−₹${formatMoney(bill.discountAmount)}`
                          : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right font-medium text-slate-800">
                        ₹{formatMoney(bill.netAmount)}
                      </td>
                      <td className="px-3 py-1.5 text-right text-emerald-600">
                        ₹{formatMoney(bill.paidAmount)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-medium text-amber-600">
                        ₹{formatMoney(bill.dueAmount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm">
        <CardContent className="space-y-3 p-3">
          <div className="space-y-1.5">
            <Label htmlFor="cancellationRemarks">
              Cancellation Remarks <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="cancellationRemarks"
              rows={3}

              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              aria-invalid={Boolean(remarksError)}
              disabled={isCancelled || cancelMutation.isPending || !bill}
              maxLength={500}
            />
            {remarksError && <p className="text-xs text-destructive">{remarksError}</p>}
          </div>
        </CardContent>
      </Card>

      <BillActionBar
        submitLabel="Cancel Bill"
        submitIcon={<Trash2 />}
        submitting={cancelMutation.isPending}
        submitDisabled={cancelDisabled}
        onSubmit={handleCancelClick}
        onClear={handleClear}
      />

      <Dialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirm Cancellation"
        description="Are you sure you want to cancel this lab bill?"
        size="md"
      >
        {bill && (
          <div className="space-y-3">
            <div className="divide-y divide-border rounded-lg border border-border text-sm">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-muted-foreground">Bill Number</span>
                <span className="font-mono font-medium text-slate-800">
                  {bill.billNumber}
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-muted-foreground">Patient</span>
                <span className="font-medium text-slate-800">
                  {patient?.fullName ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-semibold text-slate-900">
                  ₹{formatMoney(bill.netAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-muted-foreground">Reason</span>
                <span className="max-w-[60%] truncate text-right text-slate-700">
                  {remarks.trim()}
                </span>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmOpen(false)}
                disabled={cancelMutation.isPending}
              >
                No, Keep Bill
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => cancelMutation.mutate(bill.id)}
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                Yes, Cancel Bill
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
