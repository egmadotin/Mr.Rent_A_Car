import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "text-foreground",
        destructive: "border-transparent bg-destructive/15 text-destructive",
        success: "border-transparent bg-success/15 text-success",
        warning: "border-transparent bg-warning/25 text-warning-foreground dark:text-warning",
        info: "border-transparent bg-info/15 text-info",
        muted: "border-transparent bg-muted text-muted-foreground",
        "on-rent": "border-[#899779] bg-[#D8DCD2] text-[#3B511F] font-semibold dark:bg-[#3B511F]/30 dark:text-[#ECEEE9] dark:border-[#899779]",
        confirmed: "border-[#C48381] bg-[#EBD6D5] text-[#9D302D] font-semibold dark:bg-[#9D302D]/30 dark:text-[#F6EBEA] dark:border-[#C48381]",
        pending: "border-[#F7D47D] bg-[#FCF1D4] text-[#8A6508] font-semibold dark:bg-[#F1B826]/20 dark:text-[#F9E3A8] dark:border-[#F7D47D]",
        overdue: "border-transparent bg-[#9D302D] text-white font-bold",
        grounded: "border-[#ABABAB] bg-[#D5D5D5] text-[#2D2C2C] font-semibold dark:bg-[#575656] dark:text-[#EAEAEA] dark:border-[#818080]",
        closed: "border-[#B1B9A5] bg-[#ECEEE9] text-[#62744C] font-semibold dark:bg-[#3B511F]/20 dark:text-[#B1B9A5]",
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
