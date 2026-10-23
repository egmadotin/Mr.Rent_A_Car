import { cn } from "../lib/utils";

/**
 * The Mr. Rent A Car wordmark, set in Inter ExtraBold with "Mr." in brand red
 * (champagne on onyx), per the design system until the logo files are added.
 * Size it with a text-* class; the default suits a 76px header.
 *
 * variant: "auto"/"light" → ink on light grounds; "white" → white on dark grounds;
 * "signature" → on-onyx with a champagne "Mr.".
 */
export function BrandLogo({
  className,
  variant = "auto",
}: {
  className?: string;
  variant?: "auto" | "light" | "white" | "signature";
}) {
  return (
    <span
      role="img"
      aria-label="Mr. Rent A Car"
      className={cn(
        "inline-flex items-baseline text-[22px] leading-none font-extrabold tracking-[-0.045em] whitespace-nowrap select-none",
        variant === "white" ? "text-white" : variant === "signature" ? "text-on-onyx" : "text-foreground",
        className,
      )}
    >
      <span aria-hidden className={variant === "signature" ? "text-champagne" : variant === "white" ? "text-[#ff5b53]" : "text-brand"}>
        Mr.
      </span>
      <span aria-hidden>&nbsp;Rent A Car</span>
    </span>
  );
}

/** The badge alone (app icon / collapsed sidebar / favicon): a red rounded square with "M". */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-[10px] bg-brand text-[17px] leading-none font-extrabold tracking-[-0.06em] text-on-brand",
        className,
      )}
    >
      M
    </span>
  );
}
