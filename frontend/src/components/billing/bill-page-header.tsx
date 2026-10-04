"use client";

import Link from "next/link";
import { ArrowLeft, Home, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ItemTitleProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  homeHref?: string;
}

export function BillPageHeader({
  icon: Icon,
  title,
  subtitle,
  actions,
  homeHref = "/dashboard",
}: ItemTitleProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey) return;
          }}
        >
          <ArrowLeft className="size-4" />
          Back to Dashboard
        </Link>
        <h1 className="mt-0.5 flex items-center gap-2 font-heading text-base font-medium text-slate-800">
          <Icon className="size-5 text-primary" />
          {title}
        </h1>
        {subtitle && (
          <p className="text-[13px] text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <Button variant="outline" size="sm" asChild>
          <Link href={homeHref}>
            <Home />
            Home
          </Link>
        </Button>
      </div>
    </header>
  );
}