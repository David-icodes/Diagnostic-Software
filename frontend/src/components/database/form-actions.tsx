"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

interface FormActionsProps {
  onSubmit: () => void;
  onReset?: () => void;
  submitting?: boolean;
  submitLabel?: string;
  homeHref?: string;
  homeBeforeReset?: boolean;
  resetLabel?: string;
}

export function FormActions({
  onSubmit,
  onReset,
  submitting = false,
  submitLabel = "Submit",
  homeHref = "/dashboard",
  homeBeforeReset = false,
  resetLabel = "Clear",
}: FormActionsProps) {
  return (
    <div className="lis-master-actions flex flex-wrap items-center justify-center gap-2">
      <Button
        type="button"
        variant="default"
        size="sm"
        onClick={onSubmit}
        disabled={submitting}
      >
        {submitting ? "Saving..." : submitLabel}
      </Button>
      {homeBeforeReset && (
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href={homeHref}>Home</Link>
        </Button>
      )}
      {onReset && (
        <Button type="button" variant="outline" size="sm" onClick={onReset}>
          {resetLabel}
        </Button>
      )}
      {!homeBeforeReset && <Button type="button" variant="outline" size="sm" asChild>
        <Link href={homeHref}>
          Home
        </Link>
      </Button>}
    </div>
  );
}
