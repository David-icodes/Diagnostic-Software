"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/utils";
import { PAYMENT_MODES, type PaymentMode } from "@/types/billing";

interface FieldErrorProps {
  message?: string;
}

function FieldError({ message }: FieldErrorProps) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

interface BillingPaymentSectionProps {
  paymentMode: PaymentMode;
  onPaymentModeChange: (value: PaymentMode) => void;
  comments: string;
  onCommentsChange: (value: string) => void;
  displayOnBill: boolean;
  onDisplayOnBillChange: (value: boolean) => void;
  totalAmount: number;
  netAmount: number;
  balanceAmount: number;
  paidAmountInput: string;
  onPaidAmountInputChange: (value: string) => void;
  paidExceedsNet: boolean;
  discountPercentInput: string;
  onDiscountPercentChange: (value: string) => void;
  discountAmountInput: string;
  onDiscountAmountChange: (value: string) => void;
  discountInvalid: boolean;
  discountSource: "percent" | "amount";
  leftSecondary?: React.ReactNode;
}

export function BillingPaymentSection({
  paymentMode,
  onPaymentModeChange,
  comments,
  onCommentsChange,
  displayOnBill,
  onDisplayOnBillChange,
  totalAmount,
  netAmount,
  balanceAmount,
  paidAmountInput,
  onPaidAmountInputChange,
  paidExceedsNet,
  discountPercentInput,
  onDiscountPercentChange,
  discountAmountInput,
  onDiscountAmountChange,
  discountInvalid,
  discountSource,
  leftSecondary,
}: BillingPaymentSectionProps) {
  const readOnlyAmountClass =
    "h-[38px] bg-[#f1f3f5] text-right font-medium text-slate-800";

  return (
    <section
      aria-label="Payment Summary"
      className="lis-billing-payment rounded-md border border-border/80 bg-white"
    >
      <div className="grid grid-cols-1 md:grid-cols-[7fr_7fr_6fr]">
        <div className="space-y-3 p-4 md:border-r md:border-border/60">
          <h2 className="text-sm font-semibold text-slate-700">
            Payment Mode
          </h2>
          <div className="space-y-1.5">
            <Label htmlFor="paymentMode">Payment Mode</Label>
            <Select
              id="paymentMode"
              value={paymentMode}
              onChange={(event) =>
                onPaymentModeChange(event.target.value as PaymentMode)
              }
              className="h-[38px]"
            >
              {PAYMENT_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode
                    .split("_")
                    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(" ")}
                </option>
              ))}
            </Select>
          </div>
          {leftSecondary}
        </div>

        <div className="space-y-3 p-4 md:border-r md:border-border/60">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-700">Comments</h2>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={displayOnBill}
                onChange={(event) => onDisplayOnBillChange(event.target.checked)}
                className="size-4 accent-primary"
              />
              Display comments in Bill
            </label>
          </div>
          <div className="space-y-1.5">
            <Textarea
              id="comments"
              rows={3}
              maxLength={500}
              value={comments}
              onChange={(event) => onCommentsChange(event.target.value)}
              className="h-[60px] resize-none"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Prices are applied from the test catalog at bill time.
          </p>
        </div>

        <div className="space-y-3 p-4">
          <h2 className="text-sm font-semibold text-slate-700">
            Amount Summary
          </h2>
          <div className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-x-3 gap-y-2">
            <span className="text-sm text-slate-600">Total Amount</span>
            <Input
              readOnly
              tabIndex={-1}
              value={`₹${formatMoney(totalAmount)}`}
              className={readOnlyAmountClass}
            />

            <span className="text-sm text-slate-600">Enter Discount : %</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  step="0.01"
                  value={discountPercentInput}
                  onChange={(event) =>
                    onDiscountPercentChange(event.target.value)
                  }
                  aria-invalid={discountInvalid}
                  aria-label="Discount percent"
                  className="h-[38px] w-20 text-right"
                />
                <span className="text-sm font-medium text-slate-600">%</span>
                <span className="text-sm font-medium text-slate-600">₹</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={discountAmountInput}
                  onChange={(event) =>
                    onDiscountAmountChange(event.target.value)
                  }
                  aria-invalid={discountInvalid}
                  aria-label="Discount amount"
                  className="h-[38px] min-w-0 flex-1 text-right"
                />
              </div>
              <FieldError
                message={
                  discountInvalid
                    ? discountSource === "amount"
                      ? "Discount cannot exceed the total amount"
                      : "Discount must be between 0 and 100%"
                    : undefined
                }
              />
            </div>

            <span className="text-sm text-slate-600">Net Amount</span>
            <Input
              readOnly
              tabIndex={-1}
              value={`₹${formatMoney(netAmount)}`}
              className={readOnlyAmountClass}
            />

            <span className="text-sm text-slate-600">Paying Amount</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-600">₹</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={paidAmountInput}
                  onChange={(event) => onPaidAmountInputChange(event.target.value)}
                  aria-invalid={paidExceedsNet}
                  aria-label="Paying amount"
                  className="h-[38px] min-w-0 flex-1 text-right"
                />
              </div>
              <FieldError
                message={paidExceedsNet ? "Cannot exceed the net amount" : undefined}
              />
            </div>

            <span className="text-sm text-slate-600">Balance Amount</span>
            <Input
              readOnly
              tabIndex={-1}
              value={`₹${formatMoney(Math.max(0, balanceAmount))}`}
              className={readOnlyAmountClass}
              aria-invalid={paidExceedsNet}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
