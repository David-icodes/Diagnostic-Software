"use client";

import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  /**
   * Optional middle choice for questions that are neither a plain yes/no, such
   * as reusing an existing record or creating a separate one.
   */
  secondaryLabel?: string;
  onSecondary?: () => void;
  secondaryVariant?: "outline" | "ghost" | "destructive";
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  loading = false,
  onConfirm,
  secondaryLabel,
  onSecondary,
  secondaryVariant = "outline",
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onOpenChange(false)}
          disabled={loading}
        >
          <X />
          {cancelLabel}
        </Button>
        {secondaryLabel && onSecondary ? (
          <Button
            type="button"
            variant={secondaryVariant}
            size="sm"
            onClick={onSecondary}
            disabled={loading}
          >
            {secondaryLabel}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? <Loader2 className="animate-spin" /> : <Check />}
          {loading ? "Working..." : confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}