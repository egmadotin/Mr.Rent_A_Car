"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";

/**
 * Global theme for a surface (ERP or public site).
 *
 * - Light/dark via next-themes (class on <html>), stored per surface with `storageKey`.
 * - Brand palette via data-brand on <html>; swap at runtime with useBrand().setBrand().
 *   Brand token sets live in globals.css — components never change.
 */
type BrandContextValue = { brand: string; setBrand: (brand: string) => void };

const BrandContext = React.createContext<BrandContextValue | null>(null);

export function ThemeProvider({
  brand: initialBrand,
  storageKey,
  defaultTheme = "light",
  enableSystem = false,
  forcedTheme,
  children,
}: {
  brand: string;
  storageKey: string;
  defaultTheme?: "light" | "dark" | "system";
  enableSystem?: boolean;
  forcedTheme?: string;
  children: React.ReactNode;
}) {
  const [brand, setBrandState] = React.useState(initialBrand);

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}-brand`);
      if (saved) setBrandState(saved);
    } catch {}
  }, [storageKey]);

  React.useEffect(() => {
    document.documentElement.dataset.brand = brand;
  }, [brand]);

  const setBrand = React.useCallback(
    (next: string) => {
      setBrandState(next);
      try {
        localStorage.setItem(`${storageKey}-brand`, next);
      } catch {}
    },
    [storageKey],
  );

  return (
    <BrandContext.Provider value={{ brand, setBrand }}>
      <NextThemesProvider
        attribute="class"
        defaultTheme={defaultTheme}
        enableSystem={enableSystem}
        forcedTheme={forcedTheme}
        disableTransitionOnChange
        storageKey={storageKey}
      >
        {children}
      </NextThemesProvider>
    </BrandContext.Provider>
  );
}

export function useBrand() {
  const ctx = React.useContext(BrandContext);
  if (!ctx) throw new Error("useBrand must be used inside <ThemeProvider>");
  return ctx;
}

export { useTheme };
