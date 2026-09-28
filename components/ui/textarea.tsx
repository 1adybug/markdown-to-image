import * as React from "react"
import { cn } from "cn"

function Textarea({ className, variant = "default", ...props }: React.ComponentProps<"textarea"> & { variant?: "default" | "editor" }) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-16 w-full resize-none text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm",
        variant === "editor"
          ? "field-sizing-fixed rounded-none border-0 bg-transparent p-6 leading-7 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
          : "field-sizing-content rounded-2xl border border-transparent bg-input/50 px-2.5 py-2 transition-[color,box-shadow] duration-200 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
