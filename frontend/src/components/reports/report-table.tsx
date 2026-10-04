"use client";

import { cn } from "@/lib/utils";

/**
 * Single empty-state message shared by the document-style reports, so a report
 * with no matching rows never shows fabricated sample data or a misleading
 * total.
 */
export const REPORT_EMPTY_MESSAGE = "No records found for the selected filters.";

export interface ReportColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}

interface ReportTableProps<T> {
  columns: ReportColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
  loading?: boolean;
  footer?: React.ReactNode;
  rowId?: (row: T) => string | undefined;
  highlightRow?: (row: T) => boolean;
  /** Optional matching count shown while loading replaces the spinner note. */
  totalLabel?: string;
  /**
   * Scroll-area classes for the table body. Defaults to the shared report
   * height; compact reports pass their own viewport-based cap.
   */
  scrollAreaClassName?: string;
}

export function ReportTable<T>({
  columns,
  data,
  rowKey,
  emptyMessage = "No records found.",
  loading = false,
  footer,
  rowId,
  highlightRow,
  totalLabel,
  scrollAreaClassName,
}: ReportTableProps<T>) {
  const alignClass = (align: ReportColumn<T>["align"]) =>
    align === "right"
      ? "text-right"
      : align === "center"
        ? "text-center"
        : "text-left";

  return (
    <div className={cn("overflow-auto", scrollAreaClassName ?? "max-h-[min(62vh,760px)]")}>
      <table className="w-full border-collapse border border-slate-200 text-sm">
        <thead>
          <tr className="sticky top-0 z-10 bg-primary text-primary-foreground">
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(
                  "whitespace-nowrap border-b border-primary bg-primary px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide",
                  alignClass(column.align),
                  column.className,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-2 py-5 text-center text-sm text-muted-foreground"
              >
                {totalLabel ?? "Loading report data…"}
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-2 py-5 text-center text-sm text-muted-foreground"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => {
              const id = rowId?.(row);
              const highlighted = highlightRow?.(row) ?? false;
              return (
                <tr
                  key={rowKey(row)}
                  id={id}
                  className={cn(
                    "border-b border-slate-100 last:border-b-0",
                    highlighted ? "bg-blue-50" : "hover:bg-slate-50",
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        "border-r border-slate-100 px-2 py-1.5 align-top text-slate-700 last:border-r-0",
                        alignClass(column.align),
                        column.className,
                      )}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
        {footer && <tfoot>{footer}</tfoot>}
      </table>
    </div>
  );
}