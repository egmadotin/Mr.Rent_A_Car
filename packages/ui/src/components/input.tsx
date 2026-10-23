import * as React from "react";
import { cn } from "../lib/utils";

/** Field: radius-control, line-field border (3:1), 2px focus ring offset 2px. */
export const fieldClass = cn(
  "w-full min-w-0 rounded-control border border-input bg-card text-sm text-foreground transition-[border-color,box-shadow] outline-none",
  "placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
  "hover:border-foreground/60 focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  "aria-invalid:border-destructive aria-invalid:ring-destructive/30",
);

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        fieldClass,
        "flex h-(--control-height) px-3 py-1 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
