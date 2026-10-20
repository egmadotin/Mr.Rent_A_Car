/* eslint-disable @next/next/no-img-element -- static brand asset served from the app's public/ folder */
import { cn } from "../lib/utils";

/**
 * The real Mr Rent A Car wordmark (copied from mrrentacar.com into apps/web/public/legacy/).
 * Colour version on light backgrounds, white version in dark mode.
 */
export function BrandLogo({
  className,
  variant = "auto",
}: {
  className?: string;
  variant?: "auto" | "light" | "white";
}) {
  if (variant === "white") {
    return (
      <img
        src="/legacy/mrac-white-logo.png?v=3"
        alt="Mr Rent A Car"
        className={cn("h-9 w-auto max-w-full object-contain", className)}
      />
    );
  }
  if (variant === "light") {
    return (
      <img
        src="/legacy/logo.webp?v=3"
        alt="Mr Rent A Car"
        className={cn("h-9 w-auto max-w-full object-contain", className)}
      />
    );
  }
  return (
    <>
      <img
        src="/legacy/logo.webp?v=3"
        alt="Mr Rent A Car"
        className={cn("h-9 w-auto max-w-full object-contain dark:hidden", className)}
      />
      <img
        src="/legacy/mrac-white-logo.png?v=3"
        alt="Mr Rent A Car"
        className={cn("hidden h-9 w-auto max-w-full object-contain dark:block", className)}
      />
    </>
  );
}
