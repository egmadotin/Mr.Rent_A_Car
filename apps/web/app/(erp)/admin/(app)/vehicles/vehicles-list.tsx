"use client";
/* eslint-disable @next/next/no-img-element -- class photos are static files in public/legacy */

import * as React from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTRPC } from "@mrac/api/client";
import { VEHICLE_STATUSES, type VehicleStatusValue } from "@mrac/api/vehicle-status";
import { Badge } from "@mrac/ui/components/badge";
import { Button } from "@mrac/ui/components/button";
import { Card } from "@mrac/ui/components/card";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mrac/ui/components/table";
import { ListSearch, ListStatusRow, useListState } from "../../../_components/list-kit";
import { Pagination } from "../../../_components/pagination";

type Status = VehicleStatusValue;

export function VehicleStatusBadge({ status }: { status: string }) {
  const s = VEHICLE_STATUSES.find((x) => x.value === status);
  return s ? <Badge variant={s.tone}>{s.label}</Badge> : <Badge variant="outline">{status}</Badge>;
}

export function VehiclesList({ initialStatus }: { initialStatus?: string }) {
  const trpc = useTRPC();
  const [status, setStatus] = React.useState<Status | undefined>(initialStatus as Status | undefined);
  const { search, setSearch, query, paging, setPaging } = useListState([status]);

  const { data, isLoading } = useQuery({
    ...trpc.staff.vehicle.list.queryOptions({ status, search: query, ...paging }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-3 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <ListSearch value={search} onChange={setSearch} placeholder="Vehicle ID, plate, VIN, make…" label="Search vehicles" />
        <NativeSelect className="w-44" value={status ?? ""} onChange={(e) => setStatus((e.target.value || undefined) as Status | undefined)} aria-label="Status">
          <option value="">All statuses</option>
          {VEHICLE_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <Card className="gap-0 py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vehicle ID</TableHead>
              <TableHead>Make / model</TableHead>
              <TableHead>Plate</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Current location</TableHead>
              <TableHead>Owning location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Future res.</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            <ListStatusRow colSpan={9} loading={isLoading} empty={data?.rows.length === 0} emptyText="No vehicles match." />
            {data?.rows.map((v) => (
              <TableRow key={v.id}>
                <TableCell>
                  <Link href={`/admin/vehicles/${v.id}`} className="font-medium text-primary hover:underline">{v.assignedId}</Link>
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-2">
                    {v.vehicleType.imageKey ? <img src={v.vehicleType.imageKey} alt="" className="h-7 w-11 shrink-0 rounded bg-white object-contain" /> : null}
                    {v.year} {v.make.name} {v.model.name}
                  </span>
                </TableCell>
                <TableCell className="font-mono text-xs">{v.licenseNumber}</TableCell>
                <TableCell>{v.vehicleType.name}</TableCell>
                <TableCell>{v.currentLocation?.name ?? "—"}</TableCell>
                <TableCell>{v.owningLocation.name}</TableCell>
                <TableCell><VehicleStatusBadge status={v.status} /></TableCell>
                <TableCell className="text-right tabular-nums">{v._count.blocks}</TableCell>
                <TableCell className="text-right">
                  {v.status === "AVAILABLE" && (
                    <span className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" asChild><Link href={`/admin/reservations/new?vehicleId=${v.id}`}>Reserve</Link></Button>
                      <Button size="sm" variant="ghost" asChild><Link href={`/admin/rentals/new?vehicleId=${v.id}`}>Rent</Link></Button>
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination page={paging.page} pageSize={paging.pageSize} total={data?.total ?? 0} onChange={setPaging} />
      </Card>
    </div>
  );
}
