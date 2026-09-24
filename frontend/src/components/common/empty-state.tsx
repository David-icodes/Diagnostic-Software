import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  message?: string;
  className?: string;
}

export function EmptyState({ message = "No Records To Display", className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 py-10 text-sm text-muted-foreground", className)}>
      <Inbox className="size-8 opacity-40" aria-hidden />
      <p className="tracking-wide">{message}</p>
    </div>
  );
}