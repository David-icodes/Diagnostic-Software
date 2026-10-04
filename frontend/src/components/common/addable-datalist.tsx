"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface AddableDatalistProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  label?: string;
}

export function AddableDatalist({
  id,
  value,
  onChange,
  options,
  placeholder,
  className,
  label,
}: AddableDatalistProps) {
  const autoId = useId();
  const listId = `datalist-${id ?? autoId}`;
  return (
    <>
      {label && (
        <label
          htmlFor={id}
          className="mb-1 block text-xs font-medium text-slate-600"
        >
          {label}
        </label>
      )}
      <Input
        id={id}
        value={value}
        list={listId}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn("h-8", className)}
        autoComplete="off"
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </>
  );
}