"use client";

import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatisticCardProps {
  title: string;
  value: number | string;
  hint?: string;
  icon: LucideIcon;
  iconClassName?: string;
}

/**
 * Metric tile from the dashboard summary row: the value sits in the upper-left
 * with its label directly underneath, a soft tile icon in the upper-right, and
 * a date line separated by a divider across the lower portion.
 */
export function StatisticCard({
  title,
  value,
  hint,
  icon: Icon,
  iconClassName,
}: StatisticCardProps) {
  return (
    <Card className="lis-statistic-card h-[130px] border-border bg-card p-0 shadow-sm">
      <div className="flex h-full flex-col px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="lis-metric-value text-[28px] font-bold leading-none text-[#344256]">
              {value}
            </p>
            <p className="lis-metric-label mt-1.5 truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {title}
            </p>
          </div>
          <span
            className={cn(
              "lis-metric-icon flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary",
              iconClassName,
            )}
          >
            <Icon className="size-5" aria-hidden />
          </span>
        </div>
        {hint ? (
          <div className="lis-metric-date mt-auto border-t border-border pt-2 text-[11px] text-slate-500">
            {hint}
          </div>
        ) : null}
      </div>
    </Card>
  );
}