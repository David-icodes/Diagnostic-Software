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
import { useEffect, useRef } from "react";

export interface ColumnDef<T> {
  key: string;
  width?: string;
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
  completedRow?: (row: T) => boolean;
  tableClassName?: string;
  onScroll?: React.UIEventHandler<HTMLDivElement>;
  canLoadMore?: boolean;
  onLoadMore?: () => void;
}

export function BillsTable<T>({
  columns,
  rows,
  rowKey,
  maxHeightClass = "max-h-[430px]",
  emptyMessage = "No Records To Display",
  footer,
  completedRow,
  tableClassName,
  onScroll,
  canLoadMore,
  onLoadMore,
}: BillsTableProps<T>) {
  const cellContent=(row:T,column:ColumnDef<T>,index:number)=>{
    const raw=(row as Record<string,unknown>)[column.key];
    const content=column.render ? column.render(row,index) : String(raw ?? "");
    return tableClassName === "lis-due-bills-table" && ["billNo","patientId","patientName","billDate"].includes(column.key)
      ? <span className="lis-due-cell-text" title={String(raw ?? "")}>{content}</span> : content;
  };
  const container=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const node=container.current;
    if(!node||!canLoadMore||!onLoadMore)return;
    const fill=()=>{if(node.clientHeight>0&&node.scrollHeight<=node.clientHeight+1)onLoadMore();};
    fill();const observer=new ResizeObserver(fill);observer.observe(node);return()=>observer.disconnect();
  },[rows.length,canLoadMore,onLoadMore]);
  return (
    <div ref={container} onScroll={onScroll} className={cn("min-w-0 max-w-full overflow-auto", maxHeightClass)}>
      <table className={cn("w-full min-w-full table-fixed border-collapse text-sm", tableClassName)}>
        {columns.some(column => column.width) && <colgroup>{columns.map(column => <col key={column.key} style={{width:column.width}} />)}</colgroup>}
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
                data-completed={completedRow?.(row) || undefined}
                title={completedRow ? (completedRow(row) ? "Completed bill — all tests completed" : "Pending bill") : undefined}
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
                    {cellContent(row,column,index)}
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
