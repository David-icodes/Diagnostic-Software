"use client";

import {
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface ColumnDef<T> {
  key: string;
  label: React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  headerClassName?: string;
  render?: (row: T, index: number) => React.ReactNode;
}

interface BillsTableProps<T> {
  columns: ColumnDef<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string | number;
  maxHeightClass?: string;
  emptyMessage?: string;
  footer?: React.ReactNode;
}

export function BillsTable<T>({
  columns,
  rows,
  rowKey,
  maxHeightClass = "max-h-[430px]",
  emptyMessage = "No Records To Display",
  footer,
}: BillsTableProps<T>) {
  return (
    <div className={cn("overflow-auto", maxHeightClass)}>
      <table className="min-w-full table-fixed border-collapse text-sm">
        <TableHeader className="sticky top-0 z-10">
          <TableRow className="border-b border-border bg-muted hover:bg-muted">
            {columns.map((column) => (
              <TableHead
                key={column.key}
                className={cn(
                  "h-9 border-b border-border px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500",
                  column.align === "right" && "text-right",
                  column.align === "center" && "text-center",
                  column.className,
                  column.headerClassName,
                )}
              >
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow className="border-b border-border hover:bg-transparent">
              <TableCell
                colSpan={columns.length}
                className="h-24 border-b border-border px-3 py-6 text-center text-sm text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, index) => (
              <TableRow
                key={rowKey(row, index)}
                className="border-b border-border transition-colors hover:bg-slate-50"
              >
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    className={cn(
                      "h-9 whitespace-nowrap border-b border-border px-3 py-1.5 text-sm text-slate-700",
                      column.align === "right" && "text-right",
                      column.align === "center" && "text-center",
                      column.className,
                    )}
                  >
                    {column.render
                      ? column.render(row, index)
                      : String((row as Record<string, unknown>)[column.key] ?? "")}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
        {footer ? <TableFooter>{footer}</TableFooter> : null}
      </table>
    </div>
  );
}