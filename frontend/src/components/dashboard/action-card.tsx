"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ActionCardProps {
  title: string;
  icon: LucideIcon;
  hint?: string;
  href: string;
}

/**
 * Square-ish action tile from the dashboard summary row: the icon sits in the
 * upper half and the label is centred underneath it.
 */
export function ActionCard({
  title,
  icon: Icon,
  hint,
  href,
}: ActionCardProps) {
  return (
    <Card className="lis-action-card h-[130px] border-border bg-card p-0 shadow-sm transition-colors hover:border-primary/50">
      <Link
        href={href}
        className={cn(
          "flex h-full w-full flex-col items-center justify-center gap-2.5 px-3 text-center",
          "rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        )}
      >
        <span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-6" aria-hidden />
        </span>
        <span className="text-[13px] font-semibold leading-tight text-slate-800">
          {title}
        </span>
        {hint ? (
          <span className="text-[11px] leading-tight text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </Link>
    </Card>
  );
}