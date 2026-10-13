import * as React from "react"
import { cn } from "@/lib/utils"

function Select({
  className,
  children,
  style,
  ...props
}: React.ComponentProps<"select">) {
  return (
      <select
        data-slot="select"
        className={cn(
          "h-8 w-full min-w-0 appearance-none rounded-lg border border-input bg-transparent px-2.5 pr-8 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          className
        )}
        style={{
          backgroundImage: !props.multiple && !(props.size && props.size > 1) ? "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" : undefined,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 10px center",
          backgroundSize: "16px 16px",
          paddingRight: !props.multiple && !(props.size && props.size > 1) ? "34px" : undefined,
          ...style,
        }}
        {...props}
      >
        {children}
      </select>
  )
}

export { Select }
