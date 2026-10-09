"use client";

import { Loader2, RotateCcw, Search } from "lucide-react";
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
   * Shared reports use this layout by default; callers can opt into a card.
   */
  compact?: boolean;
  homeBeforeClear?: boolean;
}

/**
 * Filter section shared by every report.
 *
 * `Clear` delegates to the report to reset fields and displayed results; it never
 * deletes a database record.
 */
export function ReportFilterBar({
  children,
  onSearch,
  onClear,
  searching = false,
  searchLabel = "Show",
  homeHref = "/dashboard",
  compact = true,
  homeBeforeClear = false,
}: ReportFilterBarProps) {
  const clearAction = (
<Button
            type="button"
            variant="outline"
            size="default"
            onClick={onClear}
          >
            <RotateCcw className="size-3.5" />
            Clear
          </Button>
  );
  const homeAction = (
<Button variant="outline" size="default" asChild>
            <Link href={homeHref}>
              Home
            </Link>
          </Button>
  );
  if (compact) {
    return (
      <div className="lis-report-filter rounded-lg border border-border bg-card">
        <div className="p-2">{children}</div>
        <div className="lis-report-actions flex flex-wrap items-center gap-1.5 border-t border-border/70 px-2 py-1.5">
          <Button type="button" size="default" onClick={onSearch} disabled={searching}>
            {searching ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Search className="size-3.5" />
            )}
            {searching ? "Loading…" : searchLabel}
          </Button>
          {homeBeforeClear ? <>{homeAction}{clearAction}</> : <>{clearAction}{homeAction}</>}
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
              Home
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClear}
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
