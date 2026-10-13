"use client";

import { useRef } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SearchInputProps {
  id?: string;
  hideIcon?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
}

export function SearchInput({
  id,
  hideIcon = false,
  value,
  onChange,
  placeholder = "Search...",
  debounceMs = 300,
}: SearchInputProps) {
  const timerRef = useRef<number | null>(null);

  const handleChange = (next: string) => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      onChange(next);
    }, debounceMs);
  };

  return (
    <div className="relative w-full sm:w-72">
      {!hideIcon && <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />}
      <Input
        id={id}
        type="search"
        value={value}
        placeholder={placeholder}
        className={hideIcon ? "pl-3 pr-8" : "pl-8 pr-8"}
        onChange={(event) => handleChange(event.target.value)}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            if (timerRef.current !== null) {
              window.clearTimeout(timerRef.current);
            }
            onChange("");
          }}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
