"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCwIcon } from "lucide-react";
import { Button } from "@mrac/ui/components/button";
import { cn } from "@mrac/ui/lib/utils";

/**
 * Standard Refresh (client request, Nov 16): reloads this page's data from the server, both the server-rendered part
 * and every list / record loaded in the browser, without losing what's typed in a form.
 */
export function RefreshButton({ className }: { className?: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [pending, startTransition] = React.useTransition();
  const [fetching, setFetching] = React.useState(false);
  const busy = pending || fetching;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("gap-1.5", className)}
      title="Reload this page's data"
      disabled={busy}
      onClick={async () => {
        setFetching(true);
        startTransition(() => router.refresh());
        try {
          await qc.invalidateQueries();
        } finally {
          setFetching(false);
        }
      }}
    >
      <RefreshCwIcon className={cn("size-3.5", busy && "animate-spin")} />
      Refresh
    </Button>
  );
}
