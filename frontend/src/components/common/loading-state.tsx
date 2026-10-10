import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  label?: string;
  fullPage?: boolean;
  className?: string;
}

export function LoadingState({
  label = "Loading...",
  fullPage = false,
  className,
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-2 text-muted-foreground",
        fullPage && "min-h-[60vh]",
        className,
      )}
    >
      <Loader2 className="size-6 animate-spin" aria-hidden />
      <p className="text-sm">{label}</p>
    </div>
  );
}