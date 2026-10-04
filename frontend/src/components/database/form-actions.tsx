"use client";

import Link from "next/link";
import { Home, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FormActionsProps {
  onSubmit: () => void;
  onReset?: () => void;
  submitting?: boolean;
  submitLabel?: string;
  homeHref?: string;
}

export function FormActions({
  onSubmit,
  onReset,
  submitting = false,
  submitLabel = "Submit",
  homeHref = "/dashboard",
}: FormActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
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
      {onReset && (
        <Button type="button" variant="outline" size="sm" onClick={onReset}>
          <RotateCcw />
          Reset
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