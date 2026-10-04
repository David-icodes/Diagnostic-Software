"use client";

import Link from "next/link";
import { Home, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LabActionsProps {
  onSubmit?: () => void;
  onClear?: () => void;
  submitting?: boolean;
  submitLabel?: string;
  homeHref?: string;
}

export function LabActions({
  onSubmit,
  onClear,
  submitting = false,
  submitLabel = "Submit",
  homeHref = "/dashboard",
}: LabActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
      {onSubmit && (
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={onSubmit}
          disabled={submitting}
        >
          <Save />
          {submitting ? "Saving..." : submitLabel}
        </Button>
      )}
      {onClear && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClear}
          disabled={submitting}
        >
          Clear
        </Button>
      )}
      <Button type="button" variant="outline" size="sm" asChild>
        <Link href={homeHref}>
          <Home />
          Home
        </Link>
      </Button>
    </div>
  );
}