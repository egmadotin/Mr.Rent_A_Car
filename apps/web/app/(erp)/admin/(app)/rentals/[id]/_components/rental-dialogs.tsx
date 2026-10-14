"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@mrac/api/client";
import { toDateTimeLocal, fromDateTimeLocal } from "@mrac/ui/lib/format";
import { ConfirmAction } from "../../../../../_components/confirm-action";
import { Field, FormDialog, SelectField } from "../../../../../_components/form";
import { useRentalActions, type RentalData } from "./use-rental";

const FUEL_OPTIONS = Array.from({ length: 17 }, (_, i) => ({ value: String(i), label: `${i}/16` }));

export type RentalDialog = null | "end" | "exchange" | "reopen" | "void" | "unvoid" | "delete" | "rate";

/** The rental's confirm / form dialogs, opened from the AgreementMain action links. */
export function RentalDialogs({ data, dialog, onClose }: { data: RentalData; dialog: RentalDialog; onClose: () => void }) {
  const r = data.rental;
  const router = useRouter();
  const { api, run } = useRentalActions(r.id);
  const close = (o: boolean) => !o && onClose();

  return (
    <>
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
