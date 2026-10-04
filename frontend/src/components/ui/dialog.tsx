"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  size?: "md" | "lg";
  /**
   * Centers the panel vertically as well as horizontally instead of starting it
   * at the top. The panel still scrolls with the overlay when it is taller than
   * the viewport, so long forms stay reachable on short screens.
   */
  centered?: boolean;
  /** Extra classes for the panel's content wrapper (defaults to `p-4`). */
  bodyClassName?: string;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  size = "md",
  centered = false,
  bodyClassName,
}: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 cursor-default bg-black/45"
        onClick={() => onOpenChange(false)}
      />
      <div
        className={cn("absolute inset-0 p-4", centered ? "overflow-auto" : "overflow-y-auto")}
      >
        {/* A flex wrapper sized to its content keeps a panel wider than the
            viewport reachable: the wrapper grows and the scroll container
            scrolls, instead of centering clipping the left edge. */}
        <div className={cn(centered && "flex min-h-full min-w-full items-center justify-center")}>
          <div
            role="dialog"
            aria-modal="true"
            className={cn(
              "mx-auto flex w-full max-w-md flex-col overflow-hidden rounded-xl bg-card shadow-2xl ring-1 ring-foreground/10",
              size === "lg" && "max-w-2xl",
              centered ? "my-auto" : "mt-6 mb-6",
              className,
            )}
          >
            {(title || description) && (
              <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
                <div className="space-y-0.5">
                  {title && (
                    <h2 className="font-heading text-sm font-semibold text-slate-800">
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p className="text-xs text-muted-foreground">{description}</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onOpenChange(false)}
                  aria-label="Close"
                >
                  <X />
                </Button>
              </header>
            )}
            <div className={cn("p-4", bodyClassName)}>{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}