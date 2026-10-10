"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FormSectionProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function FormSection({
  title,
  description,
  actions,
  className,
  children,
}: FormSectionProps) {
  return (
    <section
      className={cn("lis-form-section rounded-xl bg-card p-4 ring-1 ring-foreground/10", className)}
    >
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2 border-b border-border pb-2.5">
        <div>
          <h2 className="font-heading text-sm font-semibold text-slate-800">
            {title}
          </h2>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}
