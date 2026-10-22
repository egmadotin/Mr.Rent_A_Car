"use client";

import * as React from "react";
import { useTRPCClient } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";

export function UnsubscribeButton({ c, t }: { c: string; t: string }) {
  const client = useTRPCClient();
  const [state, setState] = React.useState<"idle" | "busy" | "done" | string>("idle");
  if (state === "done") return <p className="font-semibold">You’re unsubscribed. We won’t send you marketing emails any more.</p>;
  return (
    <div className="space-y-2">
      <Button
        size="lg"
        disabled={state === "busy"}
        onClick={async () => {
          setState("busy");
          try {
            await client.customer.unsubscribe.mutate({ c, t });
            setState("done");
          } catch (e) {
            setState((e as Error).message || "Something went wrong.");
          }
        }}
      >
        Unsubscribe
      </Button>
      {state !== "idle" && state !== "busy" && <p className="text-sm text-destructive">{state}</p>}
    </div>
  );
}
