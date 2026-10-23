import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

/** Chips and status pills: radius-pill, tinted ground + strong ink. Status always carries a word. */
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-pill border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border text-foreground",
        destructive: "border-transparent bg-blush text-brand",
        success: "border-transparent bg-green-tint text-racing",
        warning: "border-transparent bg-amber-tint text-amber-ds",
        info: "border-transparent bg-steel-tint text-steel",
        muted: "border-transparent bg-muted text-muted-foreground",
        signature: "border-transparent bg-champagne-tint text-champagne-ink",
        "on-rent": "border-transparent bg-green-tint text-racing",
        confirmed: "border-transparent bg-steel-tint text-steel",
        pending: "border-transparent bg-amber-tint text-amber-ds",
        overdue: "border-transparent bg-brand text-on-brand",
        grounded: "border-border bg-muted text-foreground",
        closed: "border-transparent bg-muted text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";
  return <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
