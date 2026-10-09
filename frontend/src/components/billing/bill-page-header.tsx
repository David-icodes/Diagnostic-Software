"use client";

import Link from "next/link";
import { type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ItemTitleProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  homeHref?: string;
}

export function BillPageHeader({
  title,
  subtitle,
  actions,
  homeHref = "/dashboard",
}: ItemTitleProps) {
  return (
    <header className="lis-page-header flex flex-wrap items-center justify-between gap-2">
      <div>
        <h1 className="flex items-center gap-2 font-heading text-base font-medium text-slate-800">
          {title}
        </h1>
        {subtitle && (
          <p className="sr-only">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <Button variant="outline" size="sm" asChild>
          <Link href={homeHref}>
            Home
          </Link>
        </Button>
      </div>
    </header>
  );
}
