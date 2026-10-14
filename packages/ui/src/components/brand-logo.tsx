/* eslint-disable @next/next/no-img-element -- static brand asset served from the app's public/ folder */
import { cn } from "../lib/utils";

/**
 * The real Mr Rent A Car wordmark (copied from mrrentacar.com into apps/web/public/legacy/).
 * Colour version on light backgrounds, white version in dark mode.
 */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <>
      <img src="/legacy/logo.webp" alt="Mr Rent A Car" className={cn("h-9 w-auto dark:hidden", className)} />
      <img src="/legacy/logo-white.png" alt="Mr Rent A Car" className={cn("hidden h-9 w-auto dark:block", className)} />
    </>
  );
}
