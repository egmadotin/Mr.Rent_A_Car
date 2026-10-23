/* eslint-disable @next/next/no-img-element -- static brand asset served from the app's public/ folder */
import { cn } from "../lib/utils";

const LOGO = "/legacy/logo.webp?v=4";
const LOGO_WHITE = "/legacy/mrac-white-logo.png?v=4";

/**
 * The Mr. Rent A Car logo (public/legacy/logo.webp). Size it with a height class (default h-9).
 *
 * variant: "auto" → colour logo, white version in dark mode; "light" → always the colour logo;
 * "white" / "signature" → the white version, for dark grounds.
 */
export function BrandLogo({
  className,
  variant = "auto",
}: {
  className?: string;
  variant?: "auto" | "light" | "white" | "signature";
}) {
  const base = cn("h-9 w-auto max-w-full shrink-0 object-contain select-none", className);
  if (variant === "white" || variant === "signature") return <img src={LOGO_WHITE} alt="Mr. Rent A Car" className={base} draggable={false} />;
  if (variant === "light") return <img src={LOGO} alt="Mr. Rent A Car" className={base} draggable={false} />;
  return (
    <>
      <img src={LOGO} alt="Mr. Rent A Car" className={cn(base, "dark:hidden")} draggable={false} />
      <img src={LOGO_WHITE} alt="Mr. Rent A Car" className={cn(base, "hidden dark:block")} draggable={false} />
    </>
  );
}

/** The badge alone (collapsed sidebar, app icon): the car badge at the right end of the logo. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("block size-9 shrink-0 bg-no-repeat", className)}
      style={{ backgroundImage: `url("${LOGO}")`, backgroundSize: "auto 100%", backgroundPosition: "right center" }}
    />
  );
}
