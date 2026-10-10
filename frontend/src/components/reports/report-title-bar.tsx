"use client";

import { cn } from "@/lib/utils";

interface ReportTitleBarProps {
  /** Screen title of the report. */
  title: string;
  /** Short explanatory line under the title. */
  subtitle?: string;
  /**
   * Real controls rendered on the right (refresh, maximise, print, export…).
   * Only pass controls that perform an action — never decorative buttons.
   */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Compact report title bar: an 18px title on the left, a thin bottom border and
 * whatever functional controls the report actually offers on the right.
 *
 * Deliberately not a `Card`: the reference reports read as a single flat
 * document surface, so this is a bordered strip with no shadow or rounded
 * corners of its own.
 */
export function ReportTitleBar({
  title,
  subtitle,
  actions,
  className,
}: ReportTitleBarProps) {
  return (
    <div
      className={cn(
        "lis-report-title flex min-h-11 items-center justify-between gap-3 border-b border-border bg-card px-2.5 py-1.5",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="truncate font-heading text-[19px] leading-tight font-semibold text-slate-800">
          {title}
        </h1>
        {subtitle && (
          <p className="sr-only">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-1.5">{actions}</div>
      )}
    </div>
  );
}
