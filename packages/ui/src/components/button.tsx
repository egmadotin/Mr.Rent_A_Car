import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

/**
 * Buttons are flat with a 1px base shadow (shadow-primary), radius-control, SemiBold labels in sentence case.
 * At most ONE red (default) button per view.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-control text-sm font-semibold whitespace-nowrap transition-[background-color,color,box-shadow,transform] duration-180 ease-out-quick select-none outline-none active:translate-y-px disabled:pointer-events-none disabled:opacity-45 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-primary hover:bg-brand-deep",
        destructive: "bg-destructive text-destructive-foreground shadow-primary hover:bg-brand-deep",
        "destructive-outline": "border border-destructive/40 bg-card text-destructive hover:bg-blush",
        outline: "border border-border bg-card text-foreground shadow-primary hover:border-foreground/25 hover:bg-muted",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/70",
        ink: "bg-foreground text-background shadow-primary hover:bg-foreground/85",
        ghost: "text-foreground hover:bg-muted",
        link: "h-auto px-0 text-primary underline-offset-4 shadow-none hover:underline",
        signature: "rounded-pill bg-champagne text-on-champagne shadow-primary hover:bg-champagne-light",
      },
      size: {
        default: "h-(--control-height) px-4",
        sm: "h-8 gap-1.5 px-3 text-[13px]",
        lg: "h-12 px-6 text-[15px]",
        icon: "size-(--control-height)",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
