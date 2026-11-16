"use client";

import * as React from "react";
import { Loader2Icon } from "lucide-react";
import { Button } from "@mrac/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@mrac/ui/components/dialog";
import { Input } from "@mrac/ui/components/input";
import { Label } from "@mrac/ui/components/label";
import { money } from "@mrac/ui/lib/format";
import { isPercentLine } from "@mrac/ui/lib/charge-lines";
import { cn } from "@mrac/ui/lib/utils";
import type { EstimateLine } from "./booking-kit";
import type { ChargeEdit } from "./options-grid";

/**
 * Contract summary editing (client request, Nov 17): double-click a charge to rename it or charge it differently, or
 * double-click the total to set the agreed amount. Everything applies to this rental only; Settings stay as they are.
 */

function Choice({ checked, onChange, title, hint, disabled }: { checked: boolean; onChange: () => void; title: string; hint?: string; disabled?: boolean }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-2.5 rounded-md border p-2.5 text-sm", checked && "border-primary/60 bg-primary/5", disabled && "cursor-not-allowed opacity-50")}>
      <input type="radio" className="mt-0.5 accent-primary" checked={checked} disabled={disabled} onChange={onChange} />
      <span>
        <span className="font-medium">{title}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

/** Double-click a charge: name, and how it's charged — as calculated, at another unit rate, or one lump sum. */
export function ChargeEditDialog({
  line,
  edit,
  onSave,
  onClose,
}: {
  line: EstimateLine | null;
  edit: ChargeEdit | undefined;
  onSave: (edit: ChargeEdit | null) => void;
  onClose: () => void;
}) {
  const [name, setName] = React.useState("");
  const [mode, setMode] = React.useState<ChargeEdit["mode"]>("CALC");
  const [amount, setAmount] = React.useState("");
  React.useEffect(() => {
    if (!line) return;
    setName(edit?.name ?? line.name);
    setMode(edit?.mode ?? "CALC");
    setAmount(edit?.amount != null ? String(edit.amount) : edit?.mode === "LUMP" ? String(Number(line.total)) : String(Number(line.rate ?? 0)));
  }, [line, edit]);
  if (!line) return null;

  const percent = isPercentLine(line);
  const units = Number(line.units) || 1;
  const n = Number(amount);
  const valid = mode === "CALC" || (amount.trim() !== "" && Number.isFinite(n) && n >= 0);
  const result = mode === "LUMP" ? n : mode === "UNIT" ? (percent ? null : n * units) : null;

  function save() {
    const renamed = name.trim() && name.trim() !== line!.name ? name.trim() : edit?.name ?? null;
    if (mode === "CALC" && !renamed) return onSave(null);
    onSave({ name: renamed, mode, amount: mode === "CALC" ? null : n });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change charge — this rental only</DialogTitle>
          <DialogDescription>
            Now {money(Number(line.total))}
            {!percent && units > 1 ? ` (${units} × ${money(Number(line.rate))})` : percent ? ` (${Number(line.rate)}%)` : ""}. The charge in Settings stays as it is.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ce-name">Name on the contract</Label>
            <Input id="ce-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>How it&apos;s charged</Label>
            <Choice checked={mode === "CALC"} onChange={() => setMode("CALC")} title="As calculated" hint="The normal price from Settings" />
            <Choice
              checked={mode === "UNIT"}
              onChange={() => {
                setMode("UNIT");
                setAmount(String(Number(line.rate ?? 0)));
              }}
              title={percent ? "Another percentage" : units > 1 ? "Another rate per day / each" : "Another price"}
              hint={percent ? "% of the charges above it" : units > 1 ? `Kept as ${units} × the new rate` : undefined}
            />
            <Choice
              checked={mode === "LUMP"}
              onChange={() => {
                setMode("LUMP");
                setAmount(String(Number(line.total)));
              }}
              title="Lump sum"
              hint="One flat amount, shown as a single line"
            />
          </div>
          {mode !== "CALC" && (
            <div className="space-y-1.5">
              <Label htmlFor="ce-amount">{mode === "LUMP" ? "Lump sum ($)" : percent ? "Percentage (%)" : units > 1 ? "Rate per day / each ($)" : "Price ($)"}</Label>
              <Input id="ce-amount" type="number" min={0} step="0.01" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => e.key === "Enter" && valid && save()} />
              {result != null && Number.isFinite(result) && <p className="text-xs text-muted-foreground">On the contract: {money(result)}</p>}
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {edit ? <Button type="button" variant="ghost" onClick={() => onSave(null)}>Reset to calculated</Button> : <span />}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="button" disabled={!valid} onClick={save}>Apply</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Double-click the total: the agreed amount, met by adjusting the daily rate or by a discount line. */
export function AgreedTotalDialog({
  open,
  current,
  canRate,
  canDiscount,
  onApply,
  onClose,
}: {
  open: boolean;
  current: number;
  canRate: boolean;
  canDiscount: boolean;
  onApply: (target: number, mode: "RATE" | "DISCOUNT") => Promise<void>;
  onClose: () => void;
}) {
  const [target, setTarget] = React.useState("");
  const [mode, setMode] = React.useState<"RATE" | "DISCOUNT">(canRate ? "RATE" : "DISCOUNT");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (open) {
      setTarget(current.toFixed(2));
      setMode(canRate ? "RATE" : "DISCOUNT");
    }
  }, [open, current, canRate]);
  if (!open) return null;
  const n = Number(target);
  const valid = Number.isFinite(n) && n > 0 && Math.abs(n - current) >= 0.005;

  async function apply() {
    setBusy(true);
    try {
      await onApply(Math.round(n * 100) / 100, mode);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agreed total</DialogTitle>
          <DialogDescription>The calculated total is {money(current)}. Type the total agreed with the customer.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="at-total">Agreed total ($, taxes included)</Label>
            <Input id="at-total" type="number" min={0} step="0.01" autoFocus value={target} onChange={(e) => setTarget(e.target.value)} onKeyDown={(e) => e.key === "Enter" && valid && !busy && void apply()} />
            {valid && <p className="text-xs text-muted-foreground">{n < current ? `${money(current - n)} less` : `${money(n - current)} more`} than calculated</p>}
          </div>
          <div className="space-y-2">
            <Label>How</Label>
            <Choice
              checked={mode === "RATE"}
              disabled={!canRate}
              onChange={() => setMode("RATE")}
              title="Adjust the daily rate"
              hint={canRate ? "The rental's daily rate is set so the total comes to exactly this" : "Needs the Rate Change permission (Settings > User Groups)"}
            />
            <Choice
              checked={mode === "DISCOUNT"}
              disabled={!canDiscount}
              onChange={() => setMode("DISCOUNT")}
              title="Show the difference as a discount"
              hint="A separate Discount line on the contract (only to bring the total down; within your group's Max Discount)"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" disabled={!valid || busy} onClick={() => void apply()}>
            {busy && <Loader2Icon className="animate-spin" />}
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
