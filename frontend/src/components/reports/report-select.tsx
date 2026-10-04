"use client";

import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { ReportSelectOption } from "@/types/reports";

interface ReportSelectProps {
  id: string;
  label: string;
  value?: string;
  onChange: (value: string) => void;
  options: ReportSelectOption[];
  placeholder?: string;
}

export function ReportSelect({
  id,
  label,
  value,
  onChange,
  options,
  placeholder = "All",
}: ReportSelectProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-medium">
        {label}
      </Label>
      <Select
        id={id}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}