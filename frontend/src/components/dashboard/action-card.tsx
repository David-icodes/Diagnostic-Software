"use client";

import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ActionCardProps {
  title: string;
  icon: LucideIcon;
  hint?: string;
}

export function ActionCard({ title, icon: Icon, hint = "Coming Soon" }: ActionCardProps) {
  return (
    <Card
      aria-disabled
      className={cn(
        "select-none border-border shadow-sm",
        "cursor-not-allowed opacity-90",
      )}
    >
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">
            {title}
          </p>
          <p className="truncate text-xs text-muted-foreground">{hint}</p>
        </div>
        <Badge
          variant="outline"
          className="ml-auto hidden border-amber-200 bg-amber-50 px-1.5 text-[10px] font-medium text-amber-600 sm:inline-flex"
        >
          Soon
        </Badge>
      </CardContent>
    </Card>
  );
}