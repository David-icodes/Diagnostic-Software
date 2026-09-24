"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { BillsTable, type ColumnDef } from "@/components/dashboard/bills-table";
import { cn } from "@/lib/utils";

export type { ColumnDef } from "@/components/dashboard/bills-table";

interface BillsPanelProps<T> {
  title: string;
  icon?: LucideIcon;
  columns: ColumnDef<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string | number;
  isLoading?: boolean;
  isRefreshing?: boolean;
  error?: Error | null;
  onRefresh?: () => void;
  onRetry?: () => void;
  emptyMessage?: string;
  maxHeightClass?: string;
}

export function BillsPanel<T>({
  title,
  icon: Icon,
  columns,
  rows,
  rowKey,
  isLoading = false,
  isRefreshing = false,
  error = null,
  onRefresh,
  onRetry,
  emptyMessage = "No Records To Display",
  maxHeightClass,
}: BillsPanelProps<T>) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <Card className="flex flex-col border-border shadow-sm">
      <CardHeader className="flex-row items-center gap-2 border-b border-border py-3">
        {Icon && <Icon className="size-4 shrink-0 text-primary" />}
        <CardTitle className="text-sm font-semibold text-slate-800">
          {title}
        </CardTitle>
        <div className="ml-auto flex items-center gap-1">
          {onRefresh && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              aria-label={`Refresh ${title}`}
            >
              <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
          >
            {collapsed ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronUp className="size-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      {!collapsed && (
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-4" aria-busy>
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="h-8 animate-pulse rounded bg-muted"
                />
              ))}
            </div>
          ) : error ? (
            <ErrorState
              message={
                error.message || "Failed to load data. Please try again."
              }
              onRetry={onRetry}
            />
          ) : rows.length === 0 ? (
            <EmptyState message={emptyMessage} />
          ) : (
            <BillsTable
              columns={columns}
              rows={rows}
              rowKey={rowKey}
              maxHeightClass={maxHeightClass}
            />
          )}
        </CardContent>
      )}
    </Card>
  );
}