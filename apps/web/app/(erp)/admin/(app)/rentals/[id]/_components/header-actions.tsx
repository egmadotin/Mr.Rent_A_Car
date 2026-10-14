"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeftRightIcon,
  BanIcon,
  CoinsIcon,
  FileSearchIcon,
  FlagIcon,
  MailIcon,
  MoreHorizontalIcon,
  PrinterIcon,
  RotateCcwIcon,
  Trash2Icon,
  UndoIcon,
} from "lucide-react";
import { useTRPC } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@mrac/ui/components/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@mrac/ui/components/tooltip";
import { toDateTimeLocal, fromDateTimeLocal } from "@mrac/ui/lib/format";
import { ConfirmAction } from "../../../../../_components/confirm-action";
import { Field, FormDialog, SelectField } from "../../../../../_components/form";
import { useRentalActions, type RentalData } from "./use-rental";

const FUEL_OPTIONS = Array.from({ length: 17 }, (_, i) => ({ value: String(i), label: `${i}/16` }));

type Dialog = null | "end" | "exchange" | "reopen" | "void" | "unvoid" | "delete" | "rate";

/**
 * Legacy showed ~25 links in two identical columns regardless of state (End / ReOpen / Void /
 * UnVoid all visible at once). Here:
 *   - primary action depends on status (End when open, Reopen when closed, Unvoid when void)
 *   - routine actions are buttons (Print, Email)
 *   - rarely used + destructive actions live in "More", destructive ones separated, red, confirmed
 *   - record-level actions (payments, drivers, tickets …) live in their tab, next to their data
 */
export function HeaderActions({ data }: { data: RentalData }) {
  const r = data.rental;
  const router = useRouter();
  const { api, run } = useRentalActions(r.id);
  const [dialog, setDialog] = React.useState<Dialog>(null);
  const open = (d: Dialog) => () => setDialog(d);
  const close = (o: boolean) => !o && setDialog(null);

  return (
    <>
      {r.status === "OPEN" && (
        <>
          <Button onClick={open("end")}>
            <FlagIcon /> End rental
          </Button>
          <Button variant="outline" onClick={open("exchange")}>
            <ArrowLeftRightIcon /> Vehicle exchange
          </Button>
        </>
      )}
      {r.status === "CLOSED" && (
        <Button variant="outline" onClick={open("reopen")}>
          <RotateCcwIcon /> Reopen rental
        </Button>
      )}
      {r.status === "VOIDED" && (
        <Button variant="outline" onClick={open("unvoid")}>
          <UndoIcon /> Unvoid rental
        </Button>
      )}

      <Button variant="outline" asChild>
        <Link href={`/admin/print/rentals/${r.id}`} target="_blank">
          <PrinterIcon /> Print
        </Link>
      </Button>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* span keeps the tooltip working on a disabled button */}
          <span tabIndex={0}>
            <Button variant="outline" disabled>
              <MailIcon /> Email
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>Email agreement/invoice — available once an email provider is configured.</TooltipContent>
      </Tooltip>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="More actions">
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem onSelect={open("rate")}>
            <CoinsIcon /> Update exchange rate
          </DropdownMenuItem>
          {r.reservation && (
            <DropdownMenuItem asChild>
              <Link href={`/admin/reservations/${r.reservation.id}`}>
                <FileSearchIcon /> Original reservation #{r.reservation.number}
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem disabled>
            <FileSearchIcon /> Inspection comparison
            <span className="ml-auto text-[10px] text-muted-foreground">with Vehicles</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Danger zone</DropdownMenuLabel>
          {r.status !== "VOIDED" && (
            <DropdownMenuItem variant="destructive" onSelect={open("void")}>
              <BanIcon /> Void rental…
            </DropdownMenuItem>
          )}
          <DropdownMenuItem variant="destructive" onSelect={open("delete")}>
            <Trash2Icon /> Delete rental…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {dialog === "end" && <EndRentalDialog data={data} onOpenChange={close} />}
      {dialog === "exchange" && <ExchangeDialog data={data} onOpenChange={close} />}

      <FormDialog
        open={dialog === "rate"}
        onOpenChange={close}
        title="Update exchange rate"
        onSubmit={(v) => run(api.updateExchangeRate.mutate({ rentalId: r.id, exchangeRate: v.exchangeRate as number }))}
      >
        <Field label="Exchange rate" name="exchangeRate" type="number" step="0.000001" min="0" required defaultValue={r.exchangeRate ?? ""} />
      </FormDialog>

      <ConfirmAction
        open={dialog === "reopen"}
        onOpenChange={close}
        title="Reopen rental"
        description={<>Rental #{r.raNumber} goes back to <b>Open</b> and the vehicle is marked on rent again.</>}
        confirmLabel="Reopen rental"
        onConfirm={() => run(api.reopen.mutate({ rentalId: r.id }))}
      />
      <ConfirmAction
        open={dialog === "unvoid"}
        onOpenChange={close}
        title="Unvoid rental"
        description={<>Rental #{r.raNumber} is restored. If the vehicle has been booked since, this will be refused.</>}
        confirmLabel="Unvoid rental"
        onConfirm={() => run(api.unvoid.mutate({ rentalId: r.id }))}
      />
      <ConfirmAction
        open={dialog === "void"}
        onOpenChange={close}
        destructive
        title="Void rental"
        description={<>Rental #{r.raNumber} will be marked void and the vehicle released. You can unvoid it later.</>}
        reasonLabel="Reason (saved to memo history)"
        confirmLabel="Void rental"
        onConfirm={(reason) => run(api.void.mutate({ rentalId: r.id, reason }))}
      />
      <ConfirmAction
        open={dialog === "delete"}
        onOpenChange={close}
        destructive
        title="Delete rental"
        description={<>Rental #{r.raNumber} will be removed from all lists and reports. Prefer <b>Void</b> unless this was created by mistake.</>}
        requireText={String(r.raNumber)}
        confirmLabel="Delete rental"
        onConfirm={async () => {
          await run(api.delete.mutate({ rentalId: r.id, confirmRaNumber: r.raNumber }));
          router.push("/admin/rentals");
        }}
      />
    </>
  );
}

function useOptions() {
  const trpc = useTRPC();
  return useQuery(trpc.staff.rental.formOptions.queryOptions()).data;
}

function EndRentalDialog({ data, onOpenChange }: { data: RentalData; onOpenChange: (o: boolean) => void }) {
  const r = data.rental;
  const opts = useOptions();
  const { api, run } = useRentalActions(r.id);
  return (
    <FormDialog
      open
      onOpenChange={onOpenChange}
      title="End rental"
      description={`Check in ${r.vehicle.assignedId} (${r.vehicle.make.name} ${r.vehicle.model.name}). Odometer out was ${r.odometerOut.toLocaleString()} km.`}
      submitLabel="End rental"
      wide
      onSubmit={(v) =>
        run(
          api.end.mutate({
            rentalId: r.id,
            checkedInAt: fromDateTimeLocal(v.checkedInAt as string),
            checkInLocationId: v.checkInLocationId as string,
            odometerIn: v.odometerIn as number,
            fuelIn: v.fuelIn as number,
            checkInChannel: v.checkInChannel as string | undefined,
          }),
        )
      }
    >
      <Field label="Return date & time" name="checkedInAt" type="datetime-local" required defaultValue={toDateTimeLocal(new Date())} />
      <SelectField
        label="Return location"
        name="checkInLocationId"
        required
        defaultValue={r.checkInLocationId}
        options={(opts?.locations ?? [{ id: r.checkInLocationId, name: r.checkInLocation.name }]).map((l) => ({ value: l.id, label: l.name }))}
      />
      <Field label="Odometer in (km)" name="odometerIn" type="number" min={r.odometerOut} required />
      <SelectField label="Fuel in" name="fuelIn" required options={FUEL_OPTIONS} defaultValue="16" placeholder={false} />
      <Field label="Check-in channel" name="checkInChannel" placeholder="e.g. Counter" />
    </FormDialog>
  );
}

function ExchangeDialog({ data, onOpenChange }: { data: RentalData; onOpenChange: (o: boolean) => void }) {
  const r = data.rental;
  const opts = useOptions();
  const { api, run } = useRentalActions(r.id);
  return (
    <FormDialog
      open
      onOpenChange={onOpenChange}
      title="Vehicle exchange"
      description={`Swap ${r.vehicle.assignedId} for another available vehicle. The rental keeps its charges.`}
      submitLabel="Exchange vehicle"
      wide
      onSubmit={(v) =>
        run(
          api.exchangeVehicle.mutate({
            rentalId: r.id,
            at: fromDateTimeLocal(v.at as string),
            odometerInOld: v.odometerInOld as number,
            fuelInOld: v.fuelInOld as number,
            newVehicleId: v.newVehicleId as string,
            odometerOutNew: v.odometerOutNew as number,
            fuelOutNew: v.fuelOutNew as number,
          }),
        )
      }
    >
      <Field label="Exchange date & time" name="at" type="datetime-local" required defaultValue={toDateTimeLocal(new Date())} full />
      <Field label={`Odometer in — ${r.vehicle.assignedId}`} name="odometerInOld" type="number" min={r.odometerOut} required />
      <SelectField label={`Fuel in — ${r.vehicle.assignedId}`} name="fuelInOld" options={FUEL_OPTIONS} defaultValue="16" placeholder={false} />
      <SelectField
        label="New vehicle"
        name="newVehicleId"
        required
        full
        options={(opts?.vehicles ?? []).map((v) => ({ value: v.id, label: `${v.assignedId} — ${v.make.name} ${v.model.name}` }))}
        hint="Only vehicles currently marked Available are listed."
      />
      <Field label="Odometer out — new vehicle" name="odometerOutNew" type="number" min={0} required />
      <SelectField label="Fuel out — new vehicle" name="fuelOutNew" options={FUEL_OPTIONS} defaultValue="16" placeholder={false} />
    </FormDialog>
  );
}
