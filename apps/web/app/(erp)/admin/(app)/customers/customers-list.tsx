"use client";

import * as React from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTRPC } from "@mrac/api/client";
import { Badge } from "@mrac/ui/components/badge";
import { Card } from "@mrac/ui/components/card";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@mrac/ui/components/table";
import { date, fullName } from "@mrac/ui/lib/format";
import { ListSearch, ListStatusRow, useListState } from "../../../_components/list-kit";
import { Pagination } from "../../../_components/pagination";

type Filter = "all" | "active" | "inactive" | "undesired";

export function CustomersList() {
  const trpc = useTRPC();
  const [filter, setFilter] = React.useState<Filter>("active");
  const { search, setSearch, query, paging, setPaging } = useListState([filter]);

  const { data, isLoading } = useQuery({
    ...trpc.staff.customer.list.queryOptions({
      search: query,
      active: filter === "active" ? true : filter === "inactive" ? false : undefined,
      undesired: filter === "undesired" ? true : undefined,
      ...paging,
    }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-3 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <ListSearch value={search} onChange={setSearch} placeholder="Name, phone, email, licence, postal code…" label="Search customers" />
        <NativeSelect className="w-44" value={filter} onChange={(e) => setFilter(e.target.value as Filter)} aria-label="Filter">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="undesired">Undesired</option>
          <option value="all">All</option>
        </NativeSelect>
      </div>
      <Card className="gap-0 py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Full name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Licence #</TableHead>
              <TableHead>Date of birth</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Zip</TableHead>
              <TableHead>Date entered</TableHead>
              <TableHead>Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <ListStatusRow colSpan={9} loading={isLoading} empty={data?.rows.length === 0} emptyText="No customers match." />
            {data?.rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Link href={`/admin/customers/${c.id}`} className="font-medium text-primary hover:underline">{fullName(c)}</Link>
                  {c.isUndesired && <Badge variant="destructive" className="ml-2">Undesired</Badge>}
                </TableCell>
                <TableCell>{c.phone ?? "—"}</TableCell>
                <TableCell>{c.defaultLocation?.name ?? "—"}</TableCell>
                <TableCell>{c.licenseNumber ?? "—"}</TableCell>
                <TableCell>{date(c.birthDate)}</TableCell>
                <TableCell>{c.email ?? "—"}</TableCell>
                <TableCell>{c.postal ?? "—"}</TableCell>
                <TableCell>{new Date(c.createdAt).toLocaleDateString("en-CA")}</TableCell>
                <TableCell>{c.isActive ? "Yes" : <Badge variant="muted">No</Badge>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination page={paging.page} pageSize={paging.pageSize} total={data?.total ?? 0} onChange={setPaging} />
      </Card>
    </div>
  );
}
