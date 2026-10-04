"use client";

import {
  ChevronLeft,
  ChevronRight,
  FileDown,
  Printer,
  RefreshCw,
  Search,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ReportToolbarProps {
  page: number;
  totalPages: number;
  total: number;
  loading: boolean;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
  onExport?: () => void;
  onPrint?: () => void;
  findValue: string;
  onFindChange: (value: string) => void;
  matches: number;
  onFindNext: () => void;
  unitLabel?: string;
}

export function ReportToolbar({
  page,
  totalPages,
  total,
  loading,
  onPageChange,
  onRefresh,
  onExport,
  onPrint,
  findValue,
  onFindChange,
  matches,
  onFindNext,
  unitLabel = "records",
}: ReportToolbarProps) {
  const navButtonClass = "text-[11px] gap-1";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-2.5 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={navButtonClass}
          disabled={loading || page <= 1}
          onClick={() => onPageChange(1)}
        >
          <SkipBack className="size-3.5" />
          First
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={navButtonClass}
          disabled={loading || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-3.5" />
          Prev
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={navButtonClass}
          disabled={loading || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRight className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={navButtonClass}
          disabled={loading || page >= totalPages}
          onClick={() => onPageChange(totalPages)}
        >
          Last
          <SkipForward className="size-3.5" />
        </Button>
        <span className="ml-2 text-xs text-muted-foreground">
          Page {page} of {totalPages} · {total} {unitLabel}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <label
            htmlFor="report-find"
            className="text-xs font-medium text-slate-600"
          >
            Find:
          </label>
          <Input
            id="report-find"
            className="h-8 w-40"
            placeholder="Type to find"
            value={findValue}
            onChange={(event) => onFindChange(event.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(navButtonClass, "inline-flex items-center")}
            onClick={onFindNext}
            disabled={loading || matches === 0}
          >
            <Search className="size-3.5" />
            Next
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          title="Refresh report"
        >
          <RefreshCw className="size-3.5" />
          Refresh
        </Button>
        {onExport && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onExport}
            disabled={loading || total === 0}
            title="Download as CSV"
          >
            <FileDown className="size-3.5" />
            Export
          </Button>
        )}
        {onPrint && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onPrint}
            disabled={loading || total === 0}
            title="Print report"
          >
            <Printer className="size-3.5" />
            Print
          </Button>
        )}
      </div>
    </div>
  );
}