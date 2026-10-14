"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { useTRPCClient } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { Label } from "@mrac/ui/components/label";
import { toast } from "@mrac/ui/components/sonner";
import { Textarea } from "@mrac/ui/components/textarea";
import { errorMessage } from "../../../../_components/form";

/** RentCentric QuoteMain.aspx: one Memo box with Save. Each save is kept as a memo entry (latest shown). */
export function QuoteMemo({ quoteId, memo }: { quoteId: string; memo: string }) {
  const client = useTRPCClient();
  const router = useRouter();
  const [value, setValue] = React.useState(memo);
  const [pending, setPending] = React.useState(false);
  return (
    <div className="space-y-2">
      <Label htmlFor="quote-memo">Memo</Label>
      <Textarea id="quote-memo" rows={4} value={value} onChange={(e) => setValue(e.target.value)} />
      <div className="flex justify-end">
        <Button
          disabled={pending || value.trim() === memo.trim()}
          onClick={async () => {
            setPending(true);
            try {
              await client.staff.quote.addMemo.mutate({ quoteId, body: value.trim(), showAsPopup: false });
              toast.success("Memo saved");
              router.refresh();
            } catch (e) {
              toast.error(errorMessage(e));
            } finally {
              setPending(false);
            }
          }}
        >
          {pending && <Loader2Icon className="animate-spin" />}
          Save
        </Button>
      </div>
    </div>
  );
}
