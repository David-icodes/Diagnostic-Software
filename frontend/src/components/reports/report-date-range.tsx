"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface ReportDateRangeProps {
  fromLabel?: string;
  toLabel?: string;
  fromValue?: string;
  toValue?: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  fromId: string;
  toId: string;
}

export function ReportDateRange({
  fromLabel = "From Date",
  toLabel = "To Date",
  fromValue,
  toValue,
  onFromChange,
  onToChange,
  fromId,
  toId,
}: ReportDateRangeProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1">
        <Label htmlFor={fromId} className="text-xs font-medium">
          {fromLabel}
        </Label>
        <Input
          id={fromId}
          type="date"
          value={fromValue ?? ""}
          onChange={(event) => onFromChange(event.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={toId} className="text-xs font-medium">
          {toLabel}
        </Label>
        <Input
          id={toId}
          type="date"
          value={toValue ?? ""}
          onChange={(event) => onToChange(event.target.value)}
        />
      </div>
    </div>
  );
}