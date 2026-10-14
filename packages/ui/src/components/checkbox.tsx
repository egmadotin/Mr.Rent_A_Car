import * as React from "react";
import { cn } from "../lib/utils";

/** Native checkbox, token-coloured. Works with react-hook-form `register`. */
function Checkbox({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  return (
    <input
      type="checkbox"
      data-slot="checkbox"
      className={cn(
        "peer size-4 shrink-0 cursor-pointer rounded-sm border border-input accent-primary shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Checkbox };
