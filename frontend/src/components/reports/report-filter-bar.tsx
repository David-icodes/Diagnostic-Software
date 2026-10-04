"use client";

import { Loader2, RotateCcw, Search, Home } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ReportFilterBarProps {
  children: React.ReactNode;
  onSearch: () => void;
  onClear: () => void;
  searching?: boolean;
  searchLabel?: string;
  homeHref?: string;
  /**
   * Compact layout used by the document-style reports: a flat bordered strip
   * with tighter padding and a single `Show · Clear · Home` action row. The
   * default keeps the original card layout so existing reports are unchanged.
   */
  compact?: boolean;
}

/**
 * Filter section shared by every report.
 *
 * `Clear` only resets the filter fields and re-runs the report; it never
 * deletes a database record.
 */
export function ReportFilterBar({
  children,
  onSearch,
  onClear,
  searching = false,
  searchLabel = "Show",
  homeHref = "/dashboard",
  compact = false,
}: ReportFilterBarProps) {
  if (compact) {
    return (
      <div className="rounded-lg border border-border bg-card">
        <div className="p-2">{children}</div>
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border/70 px-2 py-1.5">
          <Button type="button" size="default" onClick={onSearch} disabled={searching}>
            {searching ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Search className="size-3.5" />
            )}
            {searching ? "Loading…" : searchLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={onClear}
            disabled={searching}
          >
            <RotateCcw className="size-3.5" />
            Clear
          </Button>
          <Button variant="outline" size="default" asChild>
            <Link href={homeHref}>
              <Home className="size-3.5" />
              Home
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-2.5">
        {children}
        <div className="flex items-center justify-between gap-2 border-t pt-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={homeHref}>
              <Home className="mr-1.5 size-3.5" />
              Home
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClear}
              disabled={searching}
            >
              <RotateCcw className="mr-1.5 size-3.5" />
              Clear
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onSearch}
              disabled={searching}
            >
              {searching ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <Search className="mr-1.5 size-3.5" />
              )}
              {searching ? "Loading…" : searchLabel}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}