"use client";

import * as React from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTRPC } from "@mrac/api/client";
import { Card } from "@mrac/ui/components/card";
import { Input } from "@mrac/ui/components/input";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mrac/ui/components/table";
import { LegacySearchBar, ListExportButtons, ListStatusRow, SearchField, exportCsv, legacyDate } from "../../../_components/list-kit";
import { Pagination } from "../../../_components/pagination";
import { RESERVATION_STATUS } from "./status";

type Filters = {
  search?: string; number?: string; firstName?: string; lastName?: string; vehicleAssignedId?: string; phone?: string; vehicleTypeId?: string;
  locationId?: string; companyName?: string; from?: string; to?: string; pickupLocationId?: string; returnLocationId?: string; legacyStatus?: string; ssn?: string;
};
const none = (v?: string) => (v?.trim() ? v.trim() : undefined);
const LEGACY_STATUSES = ["Honored", "Confirmed", "Cancelled", "Tentative", "Pending", "Null"] as const;

/**
 * ReservationsSearch.aspx: quick search (Reservation # OR First Name OR Last Name), Advanced Search, columns Reservation#,
 * First Name, Last Name, Pickup Date, Return Date, Pickup Location, Return Location, Vehicle Type, Vehicle, Status;
 * Print / Export to Excel; 200 rows; Loc. Name defaults to the working location.
 */
export function ReservationsList({ defaultLocationId }: { defaultLocationId?: string }) {
  const trpc = useTRPC();
  const o = useQuery(trpc.staff.reservation.formOptions.queryOptions()).data;
  const [draft, setDraft] = React.useState<Filters>({ locationId: defaultLocationId });
  const [filters, setFilters] = React.useState<Filters>({ locationId: defaultLocationId });
  const [paging, setPaging] = React.useState({ page: 1, pageSize: 200 });
  const set = (k: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setDraft((d) => ({ ...d, [k]: e.target.value }));

  const { data, isLoading } = useQuery({
    ...trpc.staff.reservation.list.queryOptions({
      search: none(filters.search),
      number: none(filters.number),
      firstName: none(filters.firstName),
      lastName: none(filters.lastName),
      vehicleAssignedId: none(filters.vehicleAssignedId),
      phone: none(filters.phone),
      vehicleTypeId: none(filters.vehicleTypeId),
      locationId: none(filters.locationId),
      companyName: none(filters.companyName),
      from: filters.from ? new Date(`${filters.from}T00:00:00`) : undefined,
      to: filters.to ? new Date(`${filters.to}T23:59:59`) : undefined,
      pickupLocationId: none(filters.pickupLocationId),
      returnLocationId: none(filters.returnLocationId),
      legacyStatus: none(filters.legacyStatus) as (typeof LEGACY_STATUSES)[number] | undefined,
      ssn: none(filters.ssn),
      ...paging,
    }),
    placeholderData: keepPreviousData,
  });

  const locSelect = (k: keyof Filters, id: string) => (
    <NativeSelect id={id} value={draft[k] ?? ""} onChange={set(k)}>
      <option value="">All</option>
      {o?.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
    </NativeSelect>
  );
  const status = (s: string) => RESERVATION_STATUS[s as keyof typeof RESERVATION_STATUS]?.label ?? s;
  const tz = (r: { pickupLocation: { timeZone: string } }) => r.pickupLocation.timeZone;

  return (
    <div className="space-y-3 p-4 md:p-6">
      <LegacySearchBar
        placeholder="Reservation # OR First Name OR Last Name"
        quick={draft.search ?? ""}
        onQuickChange={(v) => setDraft((d) => ({ ...d, search: v }))}
        onSearch={(mode) => {
          setFilters(mode === "quick" ? { ...filters, search: draft.search } : { ...draft });
          setPaging((p) => ({ ...p, page: 1 }));
        }}
      >
        <SearchField label="Reservation#" id="r-number"><Input id="r-number" value={draft.number ?? ""} onChange={set("number")} /></SearchField>
        <SearchField label="First Name" id="r-first"><Input id="r-first" value={draft.firstName ?? ""} onChange={set("firstName")} /></SearchField>
        <SearchField label="Last Name" id="r-last"><Input id="r-last" value={draft.lastName ?? ""} onChange={set("lastName")} /></SearchField>
        <SearchField label="Vehicle ID" id="r-veh"><Input id="r-veh" value={draft.vehicleAssignedId ?? ""} onChange={set("vehicleAssignedId")} /></SearchField>
        <SearchField label="Phone Number" id="r-phone"><Input id="r-phone" value={draft.phone ?? ""} onChange={set("phone")} /></SearchField>
        <SearchField label="Vehicle Type" id="r-type">
          <NativeSelect id="r-type" value={draft.vehicleTypeId ?? ""} onChange={set("vehicleTypeId")}>
            <option value="" />
            {o?.vehicleTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </NativeSelect>
        </SearchField>
        <SearchField label="Loc. Name" id="r-loc">{locSelect("locationId", "r-loc")}</SearchField>
        <SearchField label="Company Name" id="r-company"><Input id="r-company" value={draft.companyName ?? ""} onChange={set("companyName")} /></SearchField>
        <SearchField label="Pickup Date Begin" id="r-from"><Input id="r-from" type="date" value={draft.from ?? ""} onChange={set("from")} /></SearchField>
        <SearchField label="End" id="r-to"><Input id="r-to" type="date" value={draft.to ?? ""} onChange={set("to")} /></SearchField>
        <SearchField label="Loc. Out" id="r-out">{locSelect("pickupLocationId", "r-out")}</SearchField>
        <SearchField label="Loc. In" id="r-in">{locSelect("returnLocationId", "r-in")}</SearchField>
        <SearchField label="Status" id="r-status">
          <NativeSelect id="r-status" value={draft.legacyStatus ?? ""} onChange={set("legacyStatus")}>
            <option value="">All</option>
            {LEGACY_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </NativeSelect>
        </SearchField>
        <SearchField label="National ID/SSN" id="r-ssn"><Input id="r-ssn" value={draft.ssn ?? ""} onChange={set("ssn")} /></SearchField>
      </LegacySearchBar>

      <Card className="gap-0 py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reservation#</TableHead>
              <TableHead>First Name</TableHead>
              <TableHead>Last Name</TableHead>
              <TableHead>Pickup Date</TableHead>
              <TableHead>Return Date</TableHead>
              <TableHead>Pickup Location</TableHead>
              <TableHead>Return Location</TableHead>
              <TableHead>Vehicle Type</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <ListStatusRow colSpan={10} loading={isLoading} empty={data?.rows.length === 0} emptyText="No Records Found" />
            {data?.rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell><Link href={`/admin/reservations/${r.id}`} className="font-medium text-primary hover:underline">{r.number}</Link></TableCell>
                <TableCell>{r.firstName}</TableCell>
                <TableCell>{r.lastName}</TableCell>
                <TableCell>{legacyDate(r.pickupAt, { timeZone: tz(r) })}</TableCell>
                <TableCell>{legacyDate(r.returnAt, { timeZone: tz(r) })}</TableCell>
                <TableCell>{r.pickupLocation.name}</TableCell>
                <TableCell>{r.returnLocation.name}</TableCell>
                <TableCell>{r.vehicleType.name}</TableCell>
                <TableCell>{r.vehicle?.assignedId}</TableCell>
                <TableCell>{status(r.status)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination page={paging.page} pageSize={paging.pageSize} total={data?.total ?? 0} onChange={setPaging} />
      </Card>
      <ListExportButtons
        onExport={() =>
          exportCsv(
            "Reservations.csv",
            ["Reservation#", "First Name", "Last Name", "Pickup Date", "Return Date", "Pickup Location", "Return Location", "Vehicle Type", "Vehicle", "Status"],
            (data?.rows ?? []).map((r) => [r.number, r.firstName, r.lastName, legacyDate(r.pickupAt, { timeZone: tz(r) }), legacyDate(r.returnAt, { timeZone: tz(r) }), r.pickupLocation.name, r.returnLocation.name, r.vehicleType.name, r.vehicle?.assignedId, status(r.status)]),
          )
        }
      />
    </div>
  );
}
