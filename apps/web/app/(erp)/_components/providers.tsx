"use client";

import { ThemeProvider } from "@mrac/ui/theme";
import { TooltipProvider } from "@mrac/ui/components/tooltip";
import { Toaster } from "@mrac/ui/components/sonner";
import { TRPCReactProvider } from "@mrac/api/client";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      brand="erp"
      storageKey="mrac-erp-theme"
      defaultTheme="light"
      enableSystem
    >
      <TRPCReactProvider>
        <TooltipProvider delayDuration={300}>
          {children}
          <Toaster position="bottom-right" richColors closeButton />
        </TooltipProvider>
      </TRPCReactProvider>
    </ThemeProvider>
  );
}
