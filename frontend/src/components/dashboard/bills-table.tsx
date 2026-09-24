"use client";

import {
  TableBody,
  TableCell,
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
  render?: (row: T, index: number) => React.ReactNode;
}

interface BillsTableProps<T> {
  columns: ColumnDef<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string | number;
  maxHeightClass?: string;
}

export function BillsTable<T>({
  columns,
  rows,
  rowKey,
  maxHeightClass = "max-h-[430px]",
}: BillsTableProps<T>) {
  return (
    <div className={cn("overflow-auto", maxHeightClass)}>
      <table className="min-w-full table-fixed border-collapse text-sm">
        <TableHeader className="sticky top-0 z-10">
          <TableRow className="border-b border-border bg-muted/80 hover:bg-muted/80">
            {columns.map((column) => (
              <TableHead
                key={column.key}
                className={cn(
                  "h-9 border-b border-border px-3 text-xs font-semibold uppercase tracking-wide text-slate-500",
                  column.align === "right" && "text-right",
                  column.align === "center" && "text-center",
                  column.className,
                )}
              >
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow
              key={rowKey(row, index)}
              className="border-b border-border transition-colors hover:bg-muted/60"
            >
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  className={cn(
                    "h-9 whitespace-nowrap border-b border-border px-3 py-2 text-sm text-slate-700",
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
          ))}
        </TableBody>
      </table>
    </div>
  );
}