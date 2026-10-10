"use client";

import { useMemo, useState } from "react";
import { CheckSquare, Search, Square } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ReportSelectOption } from "@/types/reports";
import { cn } from "@/lib/utils";

interface ReportSelectionPanelProps {
  title: string;
  options: ReportSelectOption[];
  selected: string[];
  onToggle: (value: string) => void;
  onSelectAll: (values: string[]) => void;
  onClear: () => void;
  searchPlaceholder?: string;
  maxHeightClassName?: string;
  /** Renders the panel without the surrounding card chrome (inline filter use). */
  bare?: boolean;
  /** Label for the select-all checkbox. */
  selectAllLabel?: string;
}

/**
 * Reusable multi-select panel (used by the Patient Type / Payment Mode / Dept /
 * Test / Doctor / Collected By columns of the reports). Mirrors the reference
 * LIS pattern: title header, Select All checkbox, a search box and a scrollable
 * checkbox list.
 */
export function ReportSelectionPanel({
  title,
  options,
  selected,
  onToggle,
  onSelectAll,
  onClear,
  searchPlaceholder = "Search…",
  maxHeightClassName = "max-h-64",
  bare = false,
  selectAllLabel = "Select All",
}: ReportSelectionPanelProps) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return options;
    return options.filter((option) => option.label.toLowerCase().includes(keyword));
  }, [options, query]);

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((option) => selected.includes(option.value));

  const panelBody = (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-1.5">
        <h3 className="text-[13px] font-normal text-slate-600">
          {title}
        </h3>
        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1 text-[13px] font-medium text-slate-600">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={() =>
                allVisibleSelected
                  ? onClear()
                  : onSelectAll(filtered.map((option) => option.value))
              }
              className="size-3.5 accent-primary"
            />
            {selectAllLabel}
          </label>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="text-[13px] font-medium text-primary hover:underline"
            >
              Clear
            </button>
          )}
        </div>
      </div>
      <div className="border-b border-slate-100 px-3 py-1.5">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-7 pl-7 text-xs"
          />
        </div>
      </div>
      <div className={cn("space-y-0.5 overflow-y-auto px-2 py-1.5", maxHeightClassName)}>
        {filtered.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            No options found
          </p>
        ) : (
          filtered.map((option) => {
            const checked = selected.includes(option.value);
            return (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs text-slate-700 transition-colors hover:bg-slate-50"
              >
                <span
                  className={cn(
                    "flex size-3.5 shrink-0 items-center justify-center rounded-sm border",
                    checked
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-slate-300 bg-white",
                  )}
                >
                  {checked ? (
                    <CheckSquare className="size-3" />
                  ) : (
                    <Square className="size-3 text-transparent" />
                  )}
                </span>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(option.value)}
                  className="sr-only"
                />
                <span className="truncate">{option.label}</span>
              </label>
            );
          })
        )}
      </div>
    </>
  );

  if (bare) {
    return (
      <div className="lis-report-selection overflow-hidden rounded-md border border-border bg-card">
        {panelBody}
      </div>
    );
  }

  return (
    <Card className="lis-report-selection overflow-hidden">
      <CardContent className="p-0">{panelBody}</CardContent>
    </Card>
  );
}