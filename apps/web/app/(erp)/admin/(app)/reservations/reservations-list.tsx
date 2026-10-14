"use client";

import * as React from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTRPC } from "@mrac/api/client";
import { Card } from "@mrac/ui/components/card";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mrac/ui/components/table";
import { dateTime } from "@mrac/ui/lib/format";
import { ListSearch, ListStatusRow, useListState } from "../../../_components/list-kit";
import { Pagination } from "../../../_components/pagination";
import { RESERVATION_STATUS, ReservationStatusBadge } from "./status";

type Status = keyof typeof RESERVATION_STATUS;

export function ReservationsList() {
  const trpc = useTRPC();
  const [status, setStatus] = React.useState<Status | undefined>();
  const { search, setSearch, query, paging, setPaging } = useListState([status]);

  const { data, isLoading } = useQuery({
    ...trpc.staff.reservation.list.queryOptions({ status, search: query, ...paging }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-3 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <ListSearch value={search} onChange={setSearch} placeholder="Reservation #, name, phone, email…" label="Search reservations" />
        <NativeSelect className="w-44" value={status ?? ""} onChange={(e) => setStatus((e.target.value || undefined) as Status | undefined)} aria-label="Status">
          <option value="">All statuses</option>
          {Object.entries(RESERVATION_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </NativeSelect>
      </div>
      <Card className="gap-0 py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reservation #</TableHead>
              <TableHead>First name</TableHead>
              <TableHead>Last name</TableHead>
              <TableHead>Pickup</TableHead>
              <TableHead>Return</TableHead>
              <TableHead>Pickup location</TableHead>
              <TableHead>Return location</TableHead>
              <TableHead>Vehicle type</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <ListStatusRow colSpan={10} loading={isLoading} empty={data?.rows.length === 0} emptyText="No reservations match." />
            {data?.rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell><Link href={`/admin/reservations/${r.id}`} className="font-medium text-primary hover:underline">{r.number}</Link></TableCell>
                <TableCell>{r.firstName}</TableCell>
                <TableCell>{r.lastName}</TableCell>
                <TableCell>{dateTime(r.pickupAt)}</TableCell>
                <TableCell>{dateTime(r.returnAt)}</TableCell>
                <TableCell>{r.pickupLocation.name}</TableCell>
                <TableCell>{r.returnLocation.name}</TableCell>
                <TableCell>{r.vehicleType.name}</TableCell>
                <TableCell>{r.vehicle?.assignedId ?? <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                <TableCell><ReservationStatusBadge status={r.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination page={paging.page} pageSize={paging.pageSize} total={data?.total ?? 0} onChange={setPaging} />
      </Card>
    </div>
  );
}
