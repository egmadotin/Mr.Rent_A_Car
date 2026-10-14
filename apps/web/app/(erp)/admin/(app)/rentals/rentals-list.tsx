"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useTRPC } from "@mrac/api/client";
import { Card } from "@mrac/ui/components/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mrac/ui/components/table";
import { dateTime, fullName } from "@mrac/ui/lib/format";
import { cn } from "@mrac/ui/lib/utils";
import { ListSearch, ListStatusRow, useListState } from "../../../_components/list-kit";
import { Pagination } from "../../../_components/pagination";
import { RentalStatusBadge } from "./status-badge";

type Status = "OPEN" | "CLOSED" | "VOIDED" | undefined;
const FILTERS: { label: string; value: Status }[] = [
  { label: "All", value: undefined },
  { label: "Open", value: "OPEN" },
  { label: "Closed", value: "CLOSED" },
  { label: "Void", value: "VOIDED" },
];

export function RentalsList({ initialStatus }: { initialStatus?: Status }) {
  const trpc = useTRPC();
  const [status, setStatus] = React.useState<Status>(initialStatus);

  const { search, setSearch, query, paging, setPaging } = useListState([status]);

  const { data, isLoading } = useQuery({
    ...trpc.staff.rental.list.queryOptions({ status, search: query, ...paging }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-3 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <ListSearch value={search} onChange={setSearch} placeholder="Rental #, name, vehicle ID, company…" label="Search rentals" />
        <div className="flex rounded-md border p-0.5" role="group" aria-label="Status filter">
          {FILTERS.map((f) => (
            <button
              key={f.label}
              onClick={() => setStatus(f.value)}
              aria-pressed={status === f.value}
              className={cn(
                "rounded px-3 py-1 text-sm text-muted-foreground hover:text-foreground",
                status === f.value && "bg-accent font-medium text-accent-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <Card className="gap-0 py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rental #</TableHead>
              <TableHead>Renter</TableHead>
              <TableHead>Pickup</TableHead>
              <TableHead>Return</TableHead>
              <TableHead>Pickup location</TableHead>
              <TableHead>Return location</TableHead>
              <TableHead>Vehicle type</TableHead>
              <TableHead>Vehicle ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Company</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <ListStatusRow colSpan={10} loading={isLoading} empty={data?.rows.length === 0} emptyText="No rentals match." />
            {data?.rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link href={`/admin/rentals/${r.id}`} className="font-medium text-primary hover:underline">
                    {r.raNumber}
                  </Link>
                </TableCell>
                <TableCell>{fullName(r.customer)}</TableCell>
                <TableCell>{dateTime(r.checkOutAt)}</TableCell>
                <TableCell>{dateTime(r.checkedInAt ?? r.expectedReturnAt)}</TableCell>
                <TableCell>{r.checkOutLocation.name}</TableCell>
                <TableCell>{r.checkInLocation.name}</TableCell>
                <TableCell>{r.vehicleType.name}</TableCell>
                <TableCell>{r.vehicle.assignedId}</TableCell>
                <TableCell>
                  <RentalStatusBadge status={r.status} expectedReturnAt={r.expectedReturnAt} />
                </TableCell>
                <TableCell>{r.company?.name ?? ""}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination page={paging.page} pageSize={paging.pageSize} total={data?.total ?? 0} onChange={setPaging} />
      </Card>
    </div>
  );
}
