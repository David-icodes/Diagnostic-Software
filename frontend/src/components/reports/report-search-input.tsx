"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface ReportSearchInputProps {
  id: string;
  label: string;
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function ReportSearchInput({
  id,
  label,
  value,
  onChange,
  placeholder,
}: ReportSearchInputProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-medium">
        {label}
      </Label>
      <Input
        id={id}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}