"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Badge } from "@mrac/ui/components/badge";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@mrac/ui/components/card";
import { toast } from "@mrac/ui/components/sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mrac/ui/components/table";
import { date, dateTime, fromDateTimeLocal, money, toDateTimeLocal } from "@mrac/ui/lib/format";
import { ConfirmAction } from "../../../../_components/confirm-action";
import { CheckField, Field, FormDialog, PAYMENT_METHOD_OPTIONS, SelectField, TextareaField, errorMessage } from "../../../../_components/form";
import { ActionLink } from "../../../../_components/legacy-view";
import { NO_PERMISSION, useCan } from "../../../../_components/permissions";
import { RowActions } from "../../../../_components/row-actions";

type Kind = "maintenance" | "repair" | "problem" | "carwash" | "damage" | "accident" | "service" | "insurance";
type Panel = Kind | "status" | "history" | "rentals" | "reservations";
type V = Record<string, unknown>;

const STATUS_LABEL: Record<string, string> = {
  ACCIDENT_REPLACEMENT: "Accident Replacement", AUCTION: "Auction", AVAILABLE: "Available", COMPREHENSIVE: "Comprehensive", FOR_SALE: "For Sale", GROUNDED: "Grounded",
  HAS_PROBLEM: "Has Problem", HOLD_FOR_SALE: "Hold for Sale", IN_CHECKOUT_PROCESS: "In Checkout Process", IN_REPAIR: "In Repair", IN_SERVICE: "In Service",
  LEASED_REPLACEMENT: "Leased Replacement", ON_RENT: "On Rent", OUT_OF_SERVICE: "Out of Service", SOLD: "Sold", STAFF: "Staff", STOLEN: "Stolen",
};
/** The statuses RentCentric offers on Problems and Status Change. */
const STATUS_CHOICES = ["AUCTION", "AVAILABLE", "HOLD_FOR_SALE", "ON_RENT"].map((s) => ({ value: s, label: STATUS_LABEL[s]! }));
const INSURANCE_ACTIONS = [
  { value: "NO_INSURANCE", label: "No Insur." },
  { value: "FULL_COVERAGE", label: "Full Cov." },
  { value: "LIABILITY_ONLY", label: "Liab. Only" },
  { value: "COMPREHENSIVE_ONLY", label: "Comp. Only" },
];
const PERM: Record<Kind, [string, string, string]> = {
  maintenance: ["MaintenanceAdd", "MaintenanceEdit", "MaintenanceDelete"],
  repair: ["RepairsAdd", "RepairsEdit", "RepairsDelete"],
  problem: ["VehicleProblemsAdd", "VehicleProblemsEdit", "VehicleProblemsDelete"],
  carwash: ["CarwashAdd", "CarwashEdit", "CarwashDelete"],
  damage: ["DamagesAdd", "DamagesEdit", "DamagesEdit"],
  accident: ["AccidentsAdd", "AccidentsEdit", "AccidentsDelete"],
  service: ["VehiclesEdit", "VehiclesEdit", "VehiclesEdit"],
  insurance: ["VehiclesEdit", "VehiclesEdit", "VehiclesEdit"],
};

const s = (v: unknown) => (v == null ? "" : String(v));
const dtl = (v: unknown) => (v ? toDateTimeLocal(new Date(v as string)) : "");
const dIn = (v: unknown) => (v ? new Date(v as string).toISOString().slice(0, 10) : "");
const at = (v: unknown) => (v ? fromDateTimeLocal(v as string) : null);
const km = (v: unknown) => (v == null ? "—" : Number(v).toLocaleString());
const notBuilt = "Not built yet";

/** The RentCentric vehicle page actions (VehicleMain.aspx), in its order, each opening its panel. */
export function VehicleActions({ vehicleId, isActive, status }: { vehicleId: string; isActive: boolean; status: string }) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const can = useCan();
  const router = useRouter();
  const [panel, setPanel] = React.useState<Panel | null>(null);
  const [deactivate, setDeactivate] = React.useState(false);
  const data = useQuery(trpc.staff.vehicleRecords.list.queryOptions({ vehicleId })).data;
  const locations = (useQuery(trpc.staff.settings.lookups.queryOptions()).data?.locations ?? []).map((l) => ({ value: l.id, label: l.name }));
  const damageLocations = (useQuery(trpc.staff.setup.lookupList.queryOptions({ kind: "DAMAGE_LOCATION" })).data ?? []).filter((x) => x.isActive).map((x) => ({ value: x.id, label: x.name }));
  const damageConditions = (useQuery(trpc.staff.setup.lookupList.queryOptions({ kind: "DAMAGE_CONDITION" })).data ?? []).filter((x) => x.isActive).map((x) => ({ value: x.id, label: x.name }));
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: trpc.staff.vehicleRecords.list.queryKey({ vehicleId }) }),
      qc.invalidateQueries({ queryKey: trpc.staff.vehicleRecords.history.queryKey({ vehicleId }) }),
    ]).then(() => router.refresh()); // the page header (status, active) is server-rendered
  const save = async (kind: Kind, id: string | undefined, d: V) => {
    await client.staff.vehicleRecords.save.mutate({ kind, id, vehicleId, data: d } as never);
    toast.success("Saved");
    await refresh();
  };
  const del = async (kind: Kind, id: string) => {
    await client.staff.vehicleRecords.delete.mutate({ kind, id });
    await refresh();
  };
  const user = (id: unknown) => (id ? data?.userNames[id as string] : null) ?? "—";
  const toggle = (p: Panel) => setPanel((x) => (x === p ? null : p));

  /** A list panel with Add New, Edit and Delete, for one record kind. */
  function RecordPanel<T extends { id: string }>({ kind, title, rows, head, cells, form, toData, wide }: {
    kind: Kind; title: string; rows: T[]; head: string[]; cells: (r: T) => React.ReactNode[]; form: (r?: T) => React.ReactNode; toData: (v: V) => V; wide?: boolean;
  }) {
    const [addP, editP, delP] = PERM[kind];
    return (
      <Card className="gap-2 py-4">
        <CardHeader className="flex-row items-center justify-between px-4">
          <CardTitle className="font-serif text-lg">{title}</CardTitle>
          {can(addP) ? (
            <FormDialog title={`Add ${title}`} wide={wide} trigger={<Button size="sm"><PlusIcon /> Add New</Button>} onSubmit={(v) => save(kind, undefined, toData(v))}>{form()}</FormDialog>
          ) : (
            <Button size="sm" disabled title={NO_PERMISSION}><PlusIcon /> Add New</Button>
          )}
        </CardHeader>
        <CardContent className="px-0">
          {rows.length === 0 ? (
            <p className="px-4 text-sm text-muted-foreground">No records.</p>
          ) : (
            <Table>
              <TableHeader><TableRow>{head.map((h) => <TableHead key={h}>{h}</TableHead>)}<TableHead className="w-20" /></TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    {cells(r).map((c, i) => <TableCell key={i} className="align-top">{c}</TableCell>)}
                    <TableCell>
                      <RowActions label={title.toLowerCase()} canEdit={can(editP)} canDelete={can(delP)} editTitle={`Edit ${title}`} wide={wide} onSave={(v) => save(kind, r.id, toData(v))} onDelete={() => del(kind, r.id)}>
                        {form(r)}
                      </RowActions>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    );
  }

  const links: [string, Panel | null, string?][] = [
    ["Ownership Information", null, notBuilt],
    ["Damage", "damage"],
    ["Accidents", "accident"],
    ["Insurances", "insurance"],
    ["Vehicle Condition", null, notBuilt],
    ["Status Change", "status"],
    ["Vehicle History", "history"],
    ["Maintenance", "maintenance"],
    ["Problems", "problem"],
    ["Repairs", "repair"],
    ["Vehicle Services", "service"],
    ["Carwash", "carwash"],
    ["Rentals", "rentals"],
    ["Reservations", "reservations"],
    ["Customer Reported Damages", null, notBuilt],
    ["Inspection Comparison", null, notBuilt],
    ["Vehicle Inspection", null, notBuilt],
    ["Vehicle Checklist", null, notBuilt],
  ];

  return (
    <div className="space-y-4">
      <Card className="py-4">
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-1.5 px-4 text-sm sm:grid-cols-3 lg:grid-cols-4">
          {links.map(([label, p, title]) => (
            <ActionLink key={label} onClick={p ? () => toggle(p) : undefined} active={!!p && panel === p} disabled={!p} title={title}>{label}</ActionLink>
          ))}
          {isActive ? (
            <ActionLink onClick={() => setDeactivate(true)} disabled={!can("VehiclesDelete")} title={NO_PERMISSION}>Deactivate</ActionLink>
          ) : (
            <ActionLink onClick={() => client.staff.vehicleRecords.setActive.mutate({ vehicleId, active: true }).then(refresh).then(() => toast.success("Vehicle reactivated"), (e) => toast.error(errorMessage(e)))} disabled={!can("VehiclesDelete")} title={NO_PERMISSION}>Reactivate</ActionLink>
          )}
        </CardContent>
      </Card>

      <ConfirmAction
        open={deactivate}
        onOpenChange={setDeactivate}
        title="Deactivate this vehicle?"
        description={status === "ON_RENT" ? "This vehicle is on rent — end the rental first." : "It will no longer be offered for reservations or rentals. You can reactivate it later."}
        confirmLabel="Deactivate"
        destructive
        onConfirm={async () => {
          try {
            await client.staff.vehicleRecords.setActive.mutate({ vehicleId, active: false });
            await refresh();
            toast.success("Vehicle deactivated");
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      />

      {data && panel === "maintenance" && (
        <RecordPanel
          kind="maintenance" title="Maintenance" rows={data.maintenances} wide
          head={["Maintenance", "Odometer", "Date", "PO#", "Payment Type", "Payment Amount", "Memo"]}
          cells={(r) => [r.type ?? "—", km(r.odometer), date(r.date), r.poNumber ?? "—", PAYMENT_METHOD_OPTIONS.find((p) => p.value === r.paymentMethod)?.label ?? "—", r.paymentAmount != null ? money(r.paymentAmount) : "—", r.memo ?? ""]}
          toData={(v) => ({ ...v, date: at(v.date), nextDate: at(v.nextDate), nextDateRequired: !!v.nextDateRequired })}
          form={(r) => (
            <>
              <Field label="Current Maintenance Date" name="date" type="datetime-local" required defaultValue={r ? dtl(r.date) : toDateTimeLocal(new Date())} />
              <Field label="Current Maintenance Type" name="type" defaultValue={s(r?.type)} />
              <Field label="Current Maintenance Odometer" name="odometer" type="number" min={0} defaultValue={s(r?.odometer)} />
              <div className="flex items-end"><CheckField label="Future Maintenance Reminder" name="nextDateRequired" defaultChecked={r?.nextDateRequired} /></div>
              <Field label="Future Maintenance Date" name="nextDate" type="datetime-local" defaultValue={dtl(r?.nextDate)} />
              <Field label="Future Maintenance Type" name="nextType" defaultValue={s(r?.nextType)} />
              <Field label="Future Maintenance Odometer" name="nextOdometer" type="number" min={0} defaultValue={s(r?.nextOdometer)} />
              <Field label="Maintenance Shop" name="shop" defaultValue={s(r?.shop)} />
              <Field label="Shop Contact Name" name="shopContactName" defaultValue={s(r?.shopContactName)} />
              <Field label="Shop Phone Number" name="shopPhone" type="tel" defaultValue={s(r?.shopPhone)} />
              <Field label="Labour Cost" name="labourCost" type="number" min={0} step="0.01" defaultValue={s(r?.labourCost)} />
              <Field label="Parts Cost" name="partsCost" type="number" min={0} step="0.01" defaultValue={s(r?.partsCost)} />
              <SelectField label="Payment Type" name="paymentMethod" options={PAYMENT_METHOD_OPTIONS} placeholder="" defaultValue={s(r?.paymentMethod)} />
              <Field label="Payment Amount" name="paymentAmount" type="number" min={0} step="0.01" defaultValue={s(r?.paymentAmount)} />
              <Field label="PO#" name="poNumber" defaultValue={s(r?.poNumber)} />
              <TextareaField label="Memo" name="memo" rows={3} defaultValue={s(r?.memo)} />
            </>
          )}
        />
      )}

      {data && panel === "repair" && (
        <RecordPanel
          kind="repair" title="Repairs" rows={data.repairs} wide
          head={["Description", "Odometer", "Date"]}
          cells={(r) => [r.description ?? "—", km(r.odometerOut), date(r.date)]}
          toData={(v) => ({ ...v, date: at(v.date), dateDue: at(v.dateDue), pickupDate: at(v.pickupDate), returnDate: at(v.returnDate) })}
          form={(r) => (
            <>
              <Field label="Repair Date" name="date" type="datetime-local" required defaultValue={r ? dtl(r.date) : toDateTimeLocal(new Date())} />
              <Field label="Date Due" name="dateDue" type="datetime-local" defaultValue={dtl(r?.dateDue)} />
              <Field label="Pickup Date" name="pickupDate" type="datetime-local" defaultValue={dtl(r?.pickupDate)} />
              <Field label="Return Date" name="returnDate" type="datetime-local" defaultValue={dtl(r?.returnDate)} />
              <SelectField label="Pickup Location" name="pickupLocationId" options={locations} placeholder="Please Select" defaultValue={s(r?.pickupLocationId)} />
              <SelectField label="Return Location" name="returnLocationId" options={locations} placeholder="Please Select" defaultValue={s(r?.returnLocationId)} />
              <Field label="Odometer Out" name="odometerOut" type="number" min={0} defaultValue={s(r?.odometerOut)} />
              <Field label="Odometer In" name="odometerIn" type="number" min={0} defaultValue={s(r?.odometerIn)} />
              <Field label="Repair Shop" name="shopName" defaultValue={s(r?.shopName)} />
              <Field label="Total Part" name="totalParts" type="number" min={0} step="0.01" defaultValue={s(r?.totalParts)} />
              <Field label="Total Labour" name="totalLabour" type="number" min={0} step="0.01" defaultValue={s(r?.totalLabour)} />
              <Field label="Repair Order #" name="repairOrderNumber" defaultValue={s(r?.repairOrderNumber)} />
              <Field label="Purchase Order #" name="purchaseOrderNumber" defaultValue={s(r?.purchaseOrderNumber)} />
              <TextareaField label="Repair Description" name="description" rows={3} defaultValue={s(r?.description)} />
            </>
          )}
        />
      )}

      {data && panel === "problem" && (
        <RecordPanel
          kind="problem" title="Problems" rows={data.problems}
          head={["Description", "Odometer", "Date", "Status"]}
          cells={(r) => [r.description ?? "—", km(r.odometer), date(r.date), r.status ? STATUS_LABEL[r.status] : "—"]}
          toData={(v) => ({ ...v, date: at(v.date) })}
          form={(r) => (
            <>
              <Field label="Problem Date" name="date" type="datetime-local" required defaultValue={r ? dtl(r.date) : toDateTimeLocal(new Date())} />
              <Field label="Odometer" name="odometer" type="number" min={0} defaultValue={s(r?.odometer)} />
              <SelectField label="Status" name="status" options={STATUS_CHOICES} placeholder="Please select" defaultValue={s(r?.status)} hint="Also changes the vehicle's status." />
              <TextareaField label="Description" name="description" rows={3} defaultValue={s(r?.description)} />
            </>
          )}
        />
      )}

      {data && panel === "carwash" && (
        <RecordPanel
          kind="carwash" title="Carwash" rows={data.carwashes}
          head={["Date Entered", "Odometer", "Full Name"]}
          cells={(r) => [dateTime(r.date), km(r.odometer), r.washedBy ?? "—"]}
          toData={(v) => ({ ...v, date: at(v.date), updateOdometer: !!v.updateOdometer })}
          form={(r) => (
            <>
              <Field label="Carwash Date" name="date" type="datetime-local" required defaultValue={r ? dtl(r.date) : toDateTimeLocal(new Date())} />
              <Field label="Odometer" name="odometer" type="number" min={0} defaultValue={s(r?.odometer)} />
              <div className="flex items-end"><CheckField label="Update Odometer" name="updateOdometer" defaultChecked={r?.updateOdometer} /></div>
              <Field label="Car Washed By" name="washedBy" defaultValue={s(r?.washedBy)} />
              <Field label="Spot Number" name="spotNumber" defaultValue={s(r?.spotNumber)} />
              <TextareaField label="Memo" name="memo" rows={3} defaultValue={s(r?.memo)} />
            </>
          )}
        />
      )}

      {data && panel === "damage" && (
        <DamagePanel
          rows={data.damages}
          locations={damageLocations}
          conditions={damageConditions}
          vehicleId={vehicleId}
          canAdd={can("DamagesAdd")}
          canEdit={can("DamagesEdit")}
          onSave={(id, d) => save("damage", id, d)}
          onDelete={(id) => del("damage", id)}
        />
      )}

      {data && panel === "accident" && (
        <RecordPanel
          kind="accident" title="Accidents" rows={data.accidents}
          head={["Description", "Customer", "Date"]}
          cells={(r) => [r.description ?? "—", r.fullName ?? "—", date(r.date)]}
          toData={(v) => ({ ...v, date: at(v.date) })}
          form={(r) => (
            <>
              <Field label="Accident Date" name="date" type="datetime-local" required defaultValue={r ? dtl(r.date) : toDateTimeLocal(new Date())} />
              <Field label="Rental #" name="rentalId" defaultValue={s(r?.rentalId)} />
              <Field label="Full Name" name="fullName" defaultValue={s(r?.fullName)} />
              <Field label="Location" name="location" defaultValue={s(r?.location)} />
              <TextareaField label="Description" name="description" rows={3} defaultValue={s(r?.description)} />
              <TextareaField label="Memo" name="memo" rows={2} defaultValue={s(r?.memo)} />
            </>
          )}
        />
      )}

      {data && panel === "service" && (
        <RecordPanel
          kind="service" title="Vehicle Services" rows={data.services}
          head={["Company Name", "Voucher No", "Expiration Date"]}
          cells={(r) => [r.companyName, r.voucherNumber ?? "—", date(r.expirationDate)]}
          toData={(v) => v}
          form={(r) => (
            <>
              <Field label="Company Name" name="companyName" required defaultValue={s(r?.companyName)} />
              <Field label="Voucher Number" name="voucherNumber" defaultValue={s(r?.voucherNumber)} />
              <Field label="Expiration Date" name="expirationDate" type="date" defaultValue={dIn(r?.expirationDate)} />
              <TextareaField label="Memo" name="memo" rows={3} defaultValue={s(r?.memo)} />
            </>
          )}
        />
      )}

      {data && panel === "insurance" && (
        <RecordPanel
          kind="insurance" title="Insurances" rows={data.insurances} wide
          head={["Date", "Entered By", "Action Type", "Insurance Amount", "Deductable Amount", "Policy Number", "Insurance Expiry"]}
          cells={(r) => [date(r.date), user(r.enteredById), INSURANCE_ACTIONS.find((a) => a.value === r.actionType)?.label, r.insuranceAmount != null ? money(r.insuranceAmount) : "—", r.deductibleAmount != null ? money(r.deductibleAmount) : "—", r.policyNumber ?? "—", date(r.expiryDate)]}
          toData={(v) => ({ ...v, date: at(v.date) })}
          form={(r) => (
            <>
              <Field label="Date" name="date" type="datetime-local" required defaultValue={r ? dtl(r.date) : toDateTimeLocal(new Date())} />
              <Field label="Expiry Date" name="expiryDate" type="date" defaultValue={dIn(r?.expiryDate)} />
              <SelectField label="Action Type" name="actionType" required options={INSURANCE_ACTIONS} placeholder="Please Select" defaultValue={s(r?.actionType)} />
              <Field label="Insurance Amount" name="insuranceAmount" type="number" min={0} step="0.01" defaultValue={s(r?.insuranceAmount)} />
              <Field label="Deductible Amount" name="deductibleAmount" type="number" min={0} step="0.01" defaultValue={s(r?.deductibleAmount)} />
              <Field label="Policy Number" name="policyNumber" defaultValue={s(r?.policyNumber)} />
              <TextareaField label="Reason for Add/Remove" name="reason" rows={3} defaultValue={s(r?.reason)} />
            </>
          )}
        />
      )}

      {data && panel === "status" && (
        <Card className="gap-2 py-4">
          <CardHeader className="flex-row items-center justify-between px-4">
            <CardTitle className="font-serif text-lg">Status Change <span className="ml-2 text-sm font-normal text-muted-foreground">Now: {STATUS_LABEL[status] ?? status}</span></CardTitle>
            {can("VehiclesEdit") ? (
              <FormDialog
                title="Change status"
                trigger={<Button size="sm"><PlusIcon /> Add New</Button>}
                onSubmit={async (v) => {
                  await client.staff.vehicleRecords.changeStatus.mutate({ vehicleId, status: v.status as "AVAILABLE", changedAt: at(v.changedAt)!, dueBackAt: at(v.dueBackAt) });
                  toast.success("Status changed");
                  await refresh();
                }}
              >
                <SelectField label="Status" name="status" required options={STATUS_CHOICES} placeholder={false} />
                <Field label="Change Date/Time" name="changedAt" type="datetime-local" required defaultValue={toDateTimeLocal(new Date())} />
                <Field label="Due Back Date/Time" name="dueBackAt" type="datetime-local" />
              </FormDialog>
            ) : (
              <Button size="sm" disabled title={NO_PERMISSION}><PlusIcon /> Add New</Button>
            )}
          </CardHeader>
          <CardContent className="px-0">
            {data.statusChanges.length === 0 ? <p className="px-4 text-sm text-muted-foreground">No records.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Status</TableHead><TableHead>Change Date/Time</TableHead><TableHead>Due Back Date/Time</TableHead><TableHead>By</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.statusChanges.map((c) => (
                    <TableRow key={c.id}><TableCell>{c.fromStatus ? `${STATUS_LABEL[c.fromStatus]} → ` : ""}{STATUS_LABEL[c.status]}</TableCell><TableCell>{dateTime(c.changedAt)}</TableCell><TableCell>{c.dueBackAt ? dateTime(c.dueBackAt) : "—"}</TableCell><TableCell>{user(c.enteredById)}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {panel === "history" && <HistoryPanel vehicleId={vehicleId} />}
      {(panel === "rentals" || panel === "reservations") && <BookingsPanel vehicleId={vehicleId} show={panel} />}
    </div>
  );
}

type DamageRow = { id: string; date: string | Date; rentalId: string | null; locationId: string | null; conditionId: string | null; total: unknown; memo: string | null; location: { name: string } | null; condition: { name: string } | null };

/** Add Vehicle Damage (VehicleDamagesModify2.aspx): several damaged spots can be listed, then saved together. */
function DamagePanel({ rows, locations, conditions, canAdd, canEdit, onSave, onDelete }: {
  rows: DamageRow[]; locations: { value: string; label: string }[]; conditions: { value: string; label: string }[]; vehicleId: string;
  canAdd: boolean; canEdit: boolean; onSave: (id: string | undefined, d: V) => Promise<void>; onDelete: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<V[]>([]);
  const fields = (r?: DamageRow) => (
    <>
      <Field label="Date" name="date" type="datetime-local" required defaultValue={r ? dtl(r.date) : toDateTimeLocal(new Date())} />
      <Field label="Rental #" name="rentalId" defaultValue={s(r?.rentalId)} />
      <SelectField label="Damage Location" name="locationId" options={locations} placeholder={locations.length ? "Please select" : "None set up (Settings › Damage Locations)"} defaultValue={s(r?.locationId)} />
      <SelectField label="Damage Condition" name="conditionId" options={conditions} placeholder="Please select" defaultValue={s(r?.conditionId)} />
      <Field label="Total" name="total" type="number" min={0} step="0.01" required defaultValue={r ? Number(r.total).toFixed(2) : ""} />
      <TextareaField label="Memo" name="memo" rows={2} defaultValue={s(r?.memo)} />
    </>
  );
  const toData = (v: V) => ({ ...v, date: at(v.date) });
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="flex-row items-center justify-between px-4">
        <CardTitle className="font-serif text-lg">Damage</CardTitle>
        <Button size="sm" disabled={!canAdd} title={canAdd ? undefined : NO_PERMISSION} onClick={() => { setItems([]); setOpen(true); }}><PlusIcon /> Add New</Button>
      </CardHeader>
      <CardContent className="px-0">
        {rows.length === 0 ? <p className="px-4 text-sm text-muted-foreground">No records.</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Damage Location</TableHead><TableHead>Damage Condition</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="w-20" /></TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{date(r.date)}</TableCell><TableCell>{r.memo ?? "—"}</TableCell><TableCell>{r.location?.name ?? "—"}</TableCell><TableCell>{r.condition?.name ?? "—"}</TableCell><TableCell className="text-right tabular-nums">{money(r.total as string)}</TableCell>
                  <TableCell><RowActions label="damage" canEdit={canEdit} canDelete={canEdit} editTitle="Edit Vehicle Damage" onSave={(v) => onSave(r.id, toData(v))} onDelete={() => onDelete(r.id)}>{fields(r)}</RowActions></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Add Vehicle Damage"
        description={items.length ? `${items.length} damage line(s) listed — Save adds them all, or fill in another and use "Add to list".` : "Fill in a damage, then Save — or “Add to list” to enter several."}
        submitLabel={items.length ? `Save ${items.length + 1}` : "Save"}
        onSubmit={async (v) => {
          for (const it of [...items, toData(v)]) await onSave(undefined, it);
          setItems([]);
        }}
      >
        {fields()}
        <div className="sm:col-span-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(e) => {
              const form = (e.currentTarget as HTMLButtonElement).form;
              if (!form || !form.reportValidity()) return;
              const v: V = {};
              new FormData(form).forEach((val, key) => { if (val !== "") v[key] = val; });
              setItems((x) => [...x, toData(v)]);
              form.reset();
              toast.success("Added to list");
            }}
          >
            <PlusIcon /> Add to list
          </Button>
        </div>
      </FormDialog>
    </Card>
  );
}

function HistoryPanel({ vehicleId }: { vehicleId: string }) {
  const trpc = useTRPC();
  const q = useQuery(trpc.staff.vehicleRecords.history.queryOptions({ vehicleId }));
  const st = (x: string | null | undefined) => (x ? STATUS_LABEL[x] ?? x : "");
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4"><CardTitle className="font-serif text-lg">Vehicle History {q.data && <Badge variant="muted">{q.data.length}</Badge>}</CardTitle></CardHeader>
      <CardContent className="px-0">
        {!q.data?.length ? <p className="px-4 text-sm text-muted-foreground">{q.isLoading ? "Loading…" : "No records."}</p> : (
          <Table>
            <TableHeader><TableRow>{["Action", "Date", "Prev. Loc", "Cur. Loc", "Prev. Status", "Cur. Status", "Rental #", "Reservation#", "Odometer", "Fuel", "User", "Memo"].map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
            <TableBody>
              {q.data.map((r, i) => (
                <TableRow key={i}>
                  <TableCell>{r.action}</TableCell><TableCell className="whitespace-nowrap">{dateTime(r.date)}</TableCell><TableCell>{r.prevLocation ?? ""}</TableCell><TableCell>{r.curLocation ?? ""}</TableCell>
                  <TableCell>{st(r.prevStatus)}</TableCell><TableCell>{st(r.curStatus)}</TableCell>
                  <TableCell>{r.rentalId ? <Link className="text-primary hover:underline" href={`/admin/rentals/${r.rentalId}`}>{r.raNumber}</Link> : ""}</TableCell>
                  <TableCell>{r.reservationNumber ?? ""}</TableCell><TableCell>{r.odometer != null ? r.odometer.toLocaleString() : ""}</TableCell><TableCell>{r.fuel != null ? `${r.fuel}/16` : ""}</TableCell>
                  <TableCell>{r.user ?? ""}</TableCell><TableCell className="max-w-64 truncate">{r.memo ?? ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function BookingsPanel({ vehicleId, show }: { vehicleId: string; show: "rentals" | "reservations" }) {
  const trpc = useTRPC();
  const q = useQuery(trpc.staff.vehicleRecords.bookings.queryOptions({ vehicleId })).data;
  const name = (c: { firstName: string; lastName: string } | null, f?: string | null, l?: string | null) => (c ? `${c.firstName} ${c.lastName}` : [f, l].filter(Boolean).join(" ") || "—");
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="px-4"><CardTitle className="font-serif text-lg">{show === "rentals" ? "Rentals" : "Reservations"}</CardTitle></CardHeader>
      <CardContent className="px-0">
        {show === "rentals" ? (
          !q?.rentals.length ? <p className="px-4 text-sm text-muted-foreground">No records.</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Rental #</TableHead><TableHead>Customer</TableHead><TableHead>Pickup</TableHead><TableHead>Return</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>{q.rentals.map((r) => <TableRow key={r.id}><TableCell><Link className="text-primary hover:underline" href={`/admin/rentals/${r.id}`}>{r.raNumber}</Link></TableCell><TableCell>{name(r.customer)}</TableCell><TableCell>{dateTime(r.checkOutAt)}</TableCell><TableCell>{dateTime(r.checkedInAt ?? r.expectedReturnAt)}</TableCell><TableCell>{r.status.toLowerCase()}</TableCell></TableRow>)}</TableBody>
            </Table>
          )
        ) : !q?.reservations.length ? <p className="px-4 text-sm text-muted-foreground">No records.</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Reservation #</TableHead><TableHead>Customer</TableHead><TableHead>Pickup</TableHead><TableHead>Return</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>{q.reservations.map((r) => <TableRow key={r.id}><TableCell><Link className="text-primary hover:underline" href={`/admin/reservations/${r.id}`}>{r.number}</Link></TableCell><TableCell>{name(r.customer, r.firstName, r.lastName)}</TableCell><TableCell>{dateTime(r.pickupAt)}</TableCell><TableCell>{dateTime(r.returnAt)}</TableCell><TableCell>{r.status.toLowerCase().replace("_", " ")}</TableCell></TableRow>)}</TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
