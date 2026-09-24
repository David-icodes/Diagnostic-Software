"use client";

import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatisticTone = "blue" | "green" | "amber";

const TONE_CLASSES: Record<StatisticTone, { icon: string }> = {
  blue: { icon: "bg-blue-50 text-blue-700" },
  green: { icon: "bg-emerald-50 text-emerald-600" },
  amber: { icon: "bg-amber-50 text-amber-600" },
};

interface StatisticCardProps {
  title: string;
  value: number | string;
  date: string;
  icon: LucideIcon;
  tone?: StatisticTone;
}

export function StatisticCard({
  title,
  value,
  date,
  icon: Icon,
  tone = "blue",
}: StatisticCardProps) {
  return (
    <Card className="border-border shadow-sm">
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500">
            {title}
          </p>
          <p className="mt-1 text-3xl font-bold leading-none text-slate-800">
            {value}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">{date}</p>
        </div>
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg",
            TONE_CLASSES[tone].icon,
          )}
        >
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}