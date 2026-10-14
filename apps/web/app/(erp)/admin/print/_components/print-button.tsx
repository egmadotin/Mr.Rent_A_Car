"use client";

import { PrinterIcon } from "lucide-react";
import { Button } from "@mrac/ui/components/button";

export function PrintButton() {
  return (
    <Button onClick={() => window.print()}>
      <PrinterIcon /> Print
    </Button>
  );
}
