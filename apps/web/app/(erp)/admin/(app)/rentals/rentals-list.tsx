"use client";

import * as React from "react";
import Link from "next/link";
import { LinkRow } from "../../../_components/link-row";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTRPC } from "@mrac/api/client";
import { Card } from "@mrac/ui/components/card";
import { Checkbox } from "@mrac/ui/components/checkbox";
import { Input } from "@mrac/ui/components/input";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mrac/ui/components/table";
import { RATE_TYPES } from "@mrac/ui/lib/rate-types";
import { LegacySearchBar, ListExportButtons, ListStatusRow, SearchField, exportCsv, legacyDate } from "../../../_components/list-kit";
import { Pagination } from "../../../_components/pagination";

type Status = "OPEN" | "CLOSED" | "VOIDED";
type Filters = Record<string, string | boolean | undefined>;
const none = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const day = (v: unknown, end = false) => (none(v) ? new Date(`${v}T${end ? "23:59:59" : "00:00:00"}`) : undefined);
const LEGACY_STATUSES = ["Open", "Pending", "Close", "Cancelled"] as const;
/** RentCentric status wording for our statuses */
const STATUS_LABEL: Record<string, string> = { OPEN: "Open", CLOSED: "Closed", VOIDED: "Cancelled" };

/**
 * AgreementsSearch.aspx ("Rent"): quick search (Rental # OR First Name OR Last Name), Advanced Search, columns Rental #,
 * First Name, Last Name, Pickup Date, Return Date, Pickup Location, Return Location, Vehicle Type, Vehicle ID, Status,
 * Company Name; Print / Export to Excel; 200 rows; Location Name defaults to the working location.
 */
export function RentalsList({ initialStatus, defaultLocationId }: { initialStatus?: Status; defaultLocationId?: string }) {
  const trpc = useTRPC();
  const o = useQuery(trpc.staff.reservation.formOptions.queryOptions()).data;
  const makes = useQuery(trpc.staff.vehicle.formOptions.queryOptions()).data?.makes;
  const start: Filters = { locationId: initialStatus ? undefined : defaultLocationId, legacyStatus: initialStatus ? STATUS_LABEL[initialStatus] : undefined };
  const [draft, setDraft] = React.useState<Filters>(start);
  const [filters, setFilters] = React.useState<Filters>(start);
  const [paging, setPaging] = React.useState({ page: 1, pageSize: 200 });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setDraft((d) => ({ ...d, [k]: e.target.value }));
  const text = (k: string, label: string, type = "text") => (
    <SearchField label={label} id={`r-${k}`}>
      <Input id={`r-${k}`} type={type} value={(draft[k] as string) ?? ""} onChange={set(k)} />
    </SearchField>
  );
  const select = (k: string, label: string, items: { id: string; name: string }[] | undefined, blank = "") => (
    <SearchField label={label} id={`r-${k}`}>
      <NativeSelect id={`r-${k}`} value={(draft[k] as string) ?? ""} onChange={set(k)}>
        <option value="">{blank}</option>
        {items?.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </NativeSelect>
    </SearchField>
  );

  const { data, isLoading } = useQuery({
    ...trpc.staff.rental.list.queryOptions({
      search: none(filters.search),
      raNumber: none(filters.raNumber),
      reservationNumber: none(filters.reservationNumber),
      pickupFrom: day(filters.pickupFrom),
      pickupTo: day(filters.pickupTo, true),
      returnFrom: day(filters.returnFrom),
      returnTo: day(filters.returnTo, true),
      firstName: none(filters.firstName),
      lastName: none(filters.lastName),
      phone: none(filters.phone),
      companyId: none(filters.companyId),
      exchanged: filters.exchanged === true ? true : undefined,
      vehicleAssignedId: none(filters.vehicleAssignedId),
      licensePlate: none(filters.licensePlate),
      makeId: none(filters.makeId),
      vehicleTypeId: none(filters.vehicleTypeId),
      locationId: none(filters.locationId),
      checkOutLocationId: none(filters.checkOutLocationId),
      checkInLocationId: none(filters.checkInLocationId),
      ticketDate: day(filters.ticketDate),
      legacyStatus: none(filters.legacyStatus) as (typeof LEGACY_STATUSES)[number] | undefined,
      cardNumber: none(filters.cardNumber),
      claimNumber: none(filters.claimNumber),
      roNumber: none(filters.roNumber),
      poNumber: none(filters.poNumber),
      ssn: none(filters.ssn),
      rateType: none(filters.rateType),
      invoiceNumber: none(filters.invoiceNumber),
      ...paging,
    }),
    placeholderData: keepPreviousData,
  });

  const tz = (r: { checkOutLocation: { timeZone: string } }) => r.checkOutLocation.timeZone;
  const row = (r: NonNullable<typeof data>["rows"][number]) => [
    r.raNumber,
    r.customer.firstName,
    r.customer.lastName,
    legacyDate(r.checkOutAt, { timeZone: tz(r) }),
    legacyDate(r.checkedInAt ?? r.expectedReturnAt, { timeZone: tz(r) }),
    r.checkOutLocation.name,
    r.checkInLocation.name,
    r.vehicleType.name,
    r.vehicle.assignedId,
    STATUS_LABEL[r.status] ?? r.status,
    r.company?.name ?? "",
  ];

  return (
    <div className="space-y-3 p-4 md:p-6">
      <LegacySearchBar
        placeholder="Rental # OR First Name OR Last Name"
        quick={(draft.search as string) ?? ""}
        onQuickChange={(v) => setDraft((d) => ({ ...d, search: v }))}
        onSearch={(mode) => {
          setFilters(mode === "quick" ? { ...filters, search: draft.search } : { ...draft });
          setPaging((p) => ({ ...p, page: 1 }));
        }}
      >
        {text("raNumber", "Rental #")}
        {text("reservationNumber", "Reservation#")}
        {text("pickupFrom", "Pick-up Date, Begin", "date")}
        {text("pickupTo", "End", "date")}
        {text("returnFrom", "Return Date, Begin", "date")}
        {text("returnTo", "End", "date")}
        {text("firstName", "First Name")}
        {text("lastName", "Last Name")}
        {text("phone", "Phone Number")}
        {select("companyId", "Company/Corporate", o?.companies)}
        <SearchField label="Exchanged" id="r-exchanged">
          <div className="flex h-9 items-center"><Checkbox id="r-exchanged" checked={draft.exchanged === true} onChange={(e) => setDraft((d) => ({ ...d, exchanged: e.target.checked }))} /></div>
        </SearchField>
        {text("vehicleAssignedId", "Vehicle ID")}
        {text("licensePlate", "License Plate")}
        {select("makeId", "Vehicle Make", makes)}
        {select("vehicleTypeId", "Vehicle Type", o?.vehicleTypes, "Please Select")}
        {select("locationId", "Location Name", o?.locations, "All")}
        {select("checkOutLocationId", "Loc. Out", o?.locations, "All")}
        {select("checkInLocationId", "Loc. In", o?.locations, "All")}
        {text("ticketDate", "Ticket Date", "date")}
        <SearchField label="Status" id="r-status">
          <NativeSelect id="r-status" value={(draft.legacyStatus as string) ?? ""} onChange={set("legacyStatus")}>
            <option value="">ALL</option>
            {LEGACY_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </NativeSelect>
        </SearchField>
        {text("cardNumber", "Credit Card # I or II")}
        {text("claimNumber", "Claim#")}
        {text("roNumber", "RO#")}
        {text("poNumber", "PO#")}
        {text("ssn", "SSN")}
        <SearchField label="Rate Type" id="r-rateType">
          <NativeSelect id="r-rateType" value={(draft.rateType as string) ?? ""} onChange={set("rateType")}>
            <option value="">All</option>
            {RATE_TYPES.map((x) => <option key={x}>{x}</option>)}
          </NativeSelect>
        </SearchField>
        {text("invoiceNumber", "Invoice#")}
      </LegacySearchBar>

      <Card className="gap-0 py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rental #</TableHead>
              <TableHead>First Name</TableHead>
              <TableHead>Last Name</TableHead>
              <TableHead>Pickup Date</TableHead>
              <TableHead>Return Date</TableHead>
              <TableHead>Pickup Location</TableHead>
              <TableHead>Return Location</TableHead>
              <TableHead>Vehicle Type</TableHead>
              <TableHead>Vehicle ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Company Name</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <ListStatusRow colSpan={11} loading={isLoading} empty={data?.rows.length === 0} emptyText="No Records Found" />
            {data?.rows.map((r) => {
              const c = row(r);
              return (
                <LinkRow key={r.id} href={`/admin/rentals/${r.id}`}>
                  <TableCell><Link href={`/admin/rentals/${r.id}`} className="font-medium text-primary hover:underline">{r.raNumber}</Link></TableCell>
                  {c.slice(1).map((v, i) => <TableCell key={i}>{v}</TableCell>)}
                </LinkRow>
              );
            })}
          </TableBody>
        </Table>
        <Pagination page={paging.page} pageSize={paging.pageSize} total={data?.total ?? 0} onChange={setPaging} />
      </Card>
      <ListExportButtons
        onExport={() =>
          exportCsv(
            "Rentals.csv",
            ["Rental #", "First Name", "Last Name", "Pickup Date", "Return Date", "Pickup Location", "Return Location", "Vehicle Type", "Vehicle ID", "Status", "Company Name"],
            (data?.rows ?? []).map(row),
          )
        }
      />
    </div>
  );
}
