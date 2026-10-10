"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  BadgeX,
  FlaskConical,
  Printer,
  ReceiptText,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { fetchLabBill } from "@/services/billing";
import { formatDate, formatGender, formatMoney } from "@/lib/utils";
import type { BillPatient, BillDoctor } from "@/types/billing";

interface OspBillViewProps {
  billId: string;
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

export function OspBillView({ billId }: OspBillViewProps) {
  const billQuery = useQuery({
    queryKey: ["lab-bills", "detail", billId],
    queryFn: () => fetchLabBill(billId),
  });

  if (billQuery.isLoading) {
    return <LoadingState label="Loading bill..." />;
  }

  if (billQuery.error) {
    const message = billQuery.error.message;
    const notFound = message.toLowerCase().includes("not found");
    if (notFound) {
      return (
        <div className="space-y-3 py-4">
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>Bill not found.</span>
          </div>
          <Button variant="outline" asChild>
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>
      );
    }
    return (
      <ErrorState
        message={message || "Failed to load the bill. Please try again."}
        onRetry={() => void billQuery.refetch()}
      />
    );
  }

  const bill = billQuery.data;
  if (!bill) return null;

  const patient = toPatient(bill.patientId);
  const doctor = toDoctor(bill.referringDoctorId);
  const doctorDisplay = doctor?.name ?? bill.doctorName ?? "—";

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft className="size-4" />
            Back to Dashboard
          </Link>
          <h1 className="mt-0.5 flex items-center gap-2 font-heading text-base font-medium text-slate-800">
            <ReceiptText className="size-5 text-primary" />
            Bill {bill.billNumber}
          </h1>
          <p className="text-[13px] text-muted-foreground">
            Generated on {bill.createdAt ? formatDate(bill.createdAt) : "—"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {bill.status === "generated" && (
            <Badge
              variant="outline"
              className="border-emerald-200 bg-emerald-50 text-emerald-600"
            >
              <BadgeCheck className="size-3" />
              Generated
            </Badge>
          )}
          {bill.status === "cancelled" && (
            <Badge variant="destructive">
              <BadgeX className="size-3" />
              Cancelled
            </Badge>
          )}
          {bill.status === "draft" && (
            <Badge variant="secondary">Draft</Badge>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            disabled={bill.status === "cancelled"}
          >
            <Printer />
            Print
          </Button>
        </div>
      </header>

      {bill.status === "cancelled" && (
        <div
          role="alert"
          className="flex flex-wrap items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800"
        >
          <BadgeX className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">
              This bill has been cancelled on{" "}
              {bill.cancelledAt ? formatDate(bill.cancelledAt) : "—"}.
            </p>
            {bill.cancellationRemarks && (
              <p className="mt-0.5 text-xs text-amber-700">
                Reason: {bill.cancellationRemarks}
              </p>
            )}
          </div>
        </div>
      )}

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card className="border-border shadow-sm">
          <CardContent className="p-3">
            <div className="space-y-1">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <UserRound className="size-3.5" />
                Patient
              </p>
              {patient ? (
                <>
                  <p className="text-sm font-semibold text-slate-800">
                    {patient.fullName}
                    <Badge variant="secondary" className="ml-2">
                      {patient.patientId}
                    </Badge>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatGender(patient.gender)}
                    {patient.age !== undefined
                      ? ` · ${patient.age} yrs`
                      : ""}
                    {` · ${patient.mobile}`}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {String(bill.patientId)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardContent className="p-3">
            <div className="space-y-1">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <UserRound className="size-3.5" />
                Referring Doctor
              </p>
              <p className="text-sm font-semibold text-slate-800">
                {doctorDisplay}
              </p>
              <p className="text-xs text-muted-foreground">
                {doctor
                  ? [doctor.qualification, doctor.specialization]
                      .filter(Boolean)
                      .join(" · ")
                  : "Not specified"}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="border-border shadow-sm">
        <CardContent className="p-0">
          <div className="border-b border-border px-3 py-2">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <FlaskConical className="size-3.5" />
              Tests Billed
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-1.5">#</th>
                  <th className="px-3 py-1.5">Test</th>
                  <th className="px-3 py-1.5">Department</th>
                  <th className="px-3 py-1.5 text-right">Unit Price</th>
                  <th className="px-3 py-1.5 text-center">Qty</th>
                  <th className="px-3 py-1.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {bill.items.map((item, index) => (
                  <tr
                    key={item.testId + index}
                    className="border-t border-border"
                  >
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {index + 1}
                    </td>
                    <td className="px-3 py-1.5">
                      <p className="text-xs font-medium text-slate-800">
                        {item.testName}
                      </p>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {item.testCode}
                      </p>
                    </td>
                    <td className="px-3 py-1.5 text-slate-700">
                      {item.departmentName}
                    </td>
                    <td className="px-3 py-1.5 text-right text-slate-700">
                      ₹{formatMoney(item.unitPrice)}
                    </td>
                    <td className="px-3 py-1.5 text-center text-slate-700">
                      {item.quantity}
                    </td>
                    <td className="px-3 py-1.5 text-right font-medium text-slate-800">
                      ₹{formatMoney(item.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col items-end gap-1.5 border-t border-border bg-slate-100 px-3 py-2 text-sm">
            <div className="flex w-full max-w-xs items-center justify-between">
              <span className="text-muted-foreground">Total</span>
              <span className="font-medium text-slate-800">
                ₹{formatMoney(bill.totalAmount)}
              </span>
            </div>
            <div className="flex w-full max-w-xs items-center justify-between">
              <span className="text-muted-foreground">Discount</span>
              <span className="font-medium text-slate-800">
                {bill.discountPercent > 0
                  ? `${bill.discountPercent}% (−₹${formatMoney(bill.discountAmount)})`
                  : "—"}
              </span>
            </div>
            <div className="flex w-full max-w-xs items-center justify-between border-t border-border pt-1.5">
              <span className="font-medium text-slate-700">Net Amount</span>
              <span className="text-base font-semibold text-slate-900">
                ₹{formatMoney(bill.netAmount)}
              </span>
            </div>
            <div className="flex w-full max-w-xs items-center justify-between">
              <span className="text-muted-foreground">
                Paid ({bill.paymentMode.replace("_", " ")})
              </span>
              <span className="font-medium text-emerald-600">
                ₹{formatMoney(bill.paidAmount)}
              </span>
            </div>
            <div className="flex w-full max-w-xs items-center justify-between">
              <span className="text-muted-foreground">Due</span>
              <span
                className={`font-medium ${
                  bill.dueAmount > 0 ? "text-amber-600" : "text-slate-800"
                }`}
              >
                ₹{formatMoney(bill.dueAmount)}
              </span>
            </div>
            {bill.displayComments && (
              <p className="mt-1 w-full max-w-xs text-right text-xs italic text-muted-foreground">
                {bill.displayComments}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}