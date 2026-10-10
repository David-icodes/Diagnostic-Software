"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

interface LabActionsProps {
  onSubmit?: () => void;
  onClear?: () => void;
  submitting?: boolean;
  submitLabel?: string;
  homeHref?: string;
  homeBeforeClear?: boolean;
  disabled?: boolean;
}

export function LabActions({
  onSubmit,
  onClear,
  submitting = false,
  submitLabel = "Submit",
  homeHref = "/dashboard",
  homeBeforeClear = false,
  disabled = false,
}: LabActionsProps) {
  return (
    <div className="lis-master-actions flex flex-wrap items-center justify-center gap-2 border-t border-border pt-3">
      {onSubmit && (
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={onSubmit}
          disabled={submitting || disabled}
        >
          {submitting ? "Saving..." : submitLabel}
        </Button>
      )}
      {homeBeforeClear && (
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href={homeHref}>Home</Link>
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
      {!homeBeforeClear && <Button type="button" variant="outline" size="sm" asChild>
        <Link href={homeHref}>
          Home
        </Link>
      </Button>}
    </div>
  );
}
