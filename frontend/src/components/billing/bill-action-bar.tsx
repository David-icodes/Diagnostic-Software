"use client";

import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface BillActionBarProps {
  submitLabel?: string;
  submitting?: boolean;
  onSubmit?: () => void;
  onClear?: () => void;
  onHome?: () => void;
  clearDisabled?: boolean;
  submitDisabled?: boolean;
  submitIcon?: React.ReactNode;
  compact?: boolean;
  children?: React.ReactNode;
}

export function BillActionBar({
  submitLabel,
  submitting = false,
  onSubmit,
  onClear,
  onHome,
  clearDisabled = false,
  submitDisabled = false,
  submitIcon,
  compact = false,
  children,
}: BillActionBarProps) {
  const router = useRouter();

  const handleHome = () => {
    if (onHome) {
      onHome();
      return;
    }
    router.push("/dashboard");
  };

  return (
    <div
      className={cn(
        "lis-bill-actions flex flex-wrap items-center justify-center gap-2",
        compact ? "pt-1" : "pt-4",
      )}
    >
      {children}
      {submitLabel && (
        <Button
          type="button"
          onClick={onSubmit}
          disabled={submitDisabled || submitting}
        >
          {submitting ? <Loader2 className="size-4 animate-spin" /> : submitIcon}
          {submitLabel}
        </Button>
      )}
      {onClear && (
        <Button
          type="button"
          variant="outline"
          onClick={onClear}
          disabled={clearDisabled || submitting}
        >
          <RotateCcw />
          Clear
        </Button>
      )}
      <Button type="button" variant="outline" onClick={handleHome}>
        Home
      </Button>
    </div>
  );
}