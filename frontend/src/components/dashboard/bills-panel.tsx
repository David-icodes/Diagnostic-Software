"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { ErrorState } from "@/components/common/error-state";
import { LoadingState } from "@/components/common/loading-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface BillsPanelProps {
  title: string;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  errorMessage?: string | null;
  onRefresh: () => void;
  children: React.ReactNode;
}

/**
 * Shared shell for the dashboard report panels: titled header with a refresh
 * and a collapse toggle, then a fixed-height body that owns its own scrolling.
 */
export function BillsPanel({
  title,
  isLoading,
  isFetching,
  isError,
  errorMessage,
  onRefresh,
  children,
}: BillsPanelProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <Card className="flex h-[clamp(320px,44vh,520px)] flex-col p-0 shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="truncate text-[15px] font-semibold text-slate-800">
          {title}
        </h2>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-slate-500 hover:text-slate-800"
            onClick={onRefresh}
            disabled={isFetching}
            aria-label={`Refresh ${title}`}
            title="Refresh"
          >
            <RefreshCw className={cn("size-4", isFetching && "animate-spin")} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-slate-500 hover:text-slate-800"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-label={expanded ? `Collapse ${title}` : `Expand ${title}`}
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? (
              <ChevronUp className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
            )}
          </Button>
        </div>
      </div>
      {expanded ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {isLoading ? (
            <LoadingState label={`Loading ${title.toLowerCase()}...`} />
          ) : isError ? (
            <ErrorState
              message={errorMessage ?? "Could not load this report."}
              onRetry={onRefresh}
            />
          ) : (
            children
          )}
        </div>
      ) : null}
    </Card>
  );
}