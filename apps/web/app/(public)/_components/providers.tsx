"use client";

import { ThemeProvider } from "@mrac/ui/theme";
import { TRPCReactProvider } from "@mrac/api/client";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider brand="public" storageKey="mrac-public-theme" defaultTheme="light">
      <TRPCReactProvider>{children}</TRPCReactProvider>
    </ThemeProvider>
  );
}
