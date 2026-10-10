"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Placeholder used whenever a report has no value for a column. */
export const REPORT_EM_DASH = "—";

/** Values longer than this are truncated in the cell and revealed on hover. */
export const REPORT_TRUNCATE_AFTER = 28;

interface ReportTruncatedCellProps {
  value: string | null | undefined;
  className?: string;
  truncateAfter?: number;
}

/**
 * Report cell renderer: missing values become an em dash and long values are
 * truncated to a single line while remaining fully readable on hover/focus.
 */
export function ReportTruncatedCell({
  value,
  className,
  truncateAfter = REPORT_TRUNCATE_AFTER,
}: ReportTruncatedCellProps) {
  const text = value ?? "";

  if (!text || text === REPORT_EM_DASH) {
    return <span className="text-muted-foreground">{text || REPORT_EM_DASH}</span>;
  }

  if (text.length <= truncateAfter) {
    return <span className={className}>{text}</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`block truncate ${className ?? ""}`} tabIndex={0}>
          {text}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-sm whitespace-normal">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
