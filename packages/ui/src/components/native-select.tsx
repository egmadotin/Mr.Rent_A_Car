import * as React from "react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "../lib/utils";
import { fieldClass } from "./input";

/** Native <select> styled like Input. Used in dense ERP forms (works with react-hook-form `register`). */
function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="native-select"
        className={cn(
          fieldClass,
          "flex h-(--control-height) cursor-pointer appearance-none py-1 pr-9 pl-3",
          "[&>option]:bg-popover [&>option]:text-popover-foreground",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

export { NativeSelect };
