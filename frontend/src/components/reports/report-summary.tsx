"use client";

import { Card, CardContent } from "@/components/ui/card";

export interface ReportSummaryItem {
  label: string;
  value: React.ReactNode;
}

interface ReportSummaryProps {
  items: ReportSummaryItem[];
  className?: string;
}

export function ReportSummary({ items, className }: ReportSummaryProps) {
  return (
    <Card className={className}>
      <CardContent className="overflow-x-auto py-3">
        <div className="grid min-w-[640px] grid-cols-3 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {items.map((item) => (
            <div
              key={item.label}
              className="flex flex-col justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
            >
              <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                {item.label}
              </span>
              <span className="mt-0.5 font-heading text-base font-semibold text-slate-800">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}