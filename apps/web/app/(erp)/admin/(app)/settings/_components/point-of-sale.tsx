"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@mrac/ui/components/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@mrac/ui/components/dialog";
import { Input } from "@mrac/ui/components/input";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { toast } from "@mrac/ui/components/sonner";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@mrac/ui/components/table";
import { Textarea } from "@mrac/ui/components/textarea";
import { FieldShell as F, errorMessage } from "../../../../_components/form";
import { ConfirmAction } from "../../../../_components/confirm-action";
import { LegacySearchBar, ListExportButtons, ListStatusRow, SearchField, exportCsv, legacyDate } from "../../../../_components/list-kit";
import { NO_PERMISSION, useCan } from "../../../../_components/permissions";
import { methodLabel, usePaymentMethods } from "../../../../_components/payment-methods";
import { SearchPicker } from "../../../../_components/search-picker";

const $ = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const num = (v: FormDataEntryValue | null) => Number(String(v ?? "").replace(/[$,]/g, "")) || 0;
const round2 = (n: number) => Math.round(n * 100) / 100;
const payLabel = (v: string | null) => (!v ? "" : v.startsWith("OTHER:") ? v.slice(6) : methodLabel({ method: v }));

type Item = { id: string; itemNumber: string | null; description: string; unitPrice: number; quantity: number; memo: string | null; taxable: boolean; locationId: string | null };

function ItemDialog({ item, open, onOpenChange, locations }: { item: Item | null; open: boolean; onOpenChange: (o: boolean) => void; locations: { id: string; name: string }[] }) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const [saving, setSaving] = React.useState(false);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await client.staff.pos.itemSave.mutate({
        id: item?.id,
        data: { itemNumber: String(fd.get("itemNumber") ?? ""), description: String(fd.get("description") ?? ""), unitPrice: num(fd.get("unitPrice")), quantity: Math.round(num(fd.get("quantity"))), memo: String(fd.get("memo") ?? ""), taxable: fd.get("taxable") === "on", locationId: String(fd.get("locationId") ?? "") || null },
      });
      await qc.invalidateQueries({ queryKey: trpc.staff.pos.items.queryKey() });
      await qc.invalidateQueries({ queryKey: trpc.staff.pos.options.queryKey() });
      toast.success("Item saved");
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader><DialogTitle>{item ? "Edit Item" : "New Item"}</DialogTitle></DialogHeader>
        <form key={item?.id ?? "new"} onSubmit={save} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <F label="Item Number" name="itemNumber"><Input id="itemNumber" name="itemNumber" defaultValue={item?.itemNumber ?? ""} /></F>
            <F label="Location" name="locationId">
              <NativeSelect id="locationId" name="locationId" defaultValue={item?.locationId ?? ""}><option value="">All locations</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</NativeSelect>
            </F>
            <F label="Description" name="description" required full><Input id="description" name="description" defaultValue={item?.description ?? ""} /></F>
            <F label="Unit Price" name="unitPrice" required><Input id="unitPrice" name="unitPrice" inputMode="decimal" defaultValue={item ? item.unitPrice.toFixed(2) : ""} /></F>
            <F label="Quantity" name="quantity" hint="In stock"><Input id="quantity" name="quantity" type="number" min={0} defaultValue={item?.quantity ?? 0} /></F>
            <F label="Memo" name="memo" full><Textarea id="memo" name="memo" rows={3} defaultValue={item?.memo ?? ""} /></F>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="taxable" defaultChecked={item?.taxable ?? true} className="size-4" /> Taxable</label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Settings > Point Of Sale > Merchandise Items (ItemsSearchAddNew.aspx). */
export function PosItems() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const can = useCan();
  const o = useQuery(trpc.staff.pos.options.queryOptions()).data;
  const [quick, setQuick] = React.useState("");
  const [filters, setFilters] = React.useState<{ description?: string; itemNumber?: string; locationId?: string; taxable?: "" | "yes" | "no"; enteredById?: string }>({});
  const [adv, setAdv] = React.useState<typeof filters>({});
  const q = useQuery(trpc.staff.pos.items.queryOptions(filters));
  const [edit, setEdit] = React.useState<{ item: Item | null } | null>(null);
  const [del, setDel] = React.useState<Item | null>(null);
  const editable = can("Settings");
  const rows = q.data ?? [];
  const set = (k: keyof typeof filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setAdv((a) => ({ ...a, [k]: e.target.value || undefined }));

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex justify-end">
        <Button onClick={() => setEdit({ item: null })} disabled={!editable} title={editable ? undefined : NO_PERMISSION}><PlusIcon /> New Items</Button>
      </div>
      <LegacySearchBar placeholder="Description" quick={quick} onQuickChange={setQuick} onSearch={(m) => setFilters(m === "quick" ? { description: quick.trim() || undefined } : adv)}>
        <SearchField label="Item Number" id="s-num"><Input id="s-num" onChange={set("itemNumber")} /></SearchField>
        <SearchField label="Locations" id="s-loc"><NativeSelect id="s-loc" onChange={set("locationId")}><option value="" />{o?.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</NativeSelect></SearchField>
        <SearchField label="Description" id="s-desc"><Input id="s-desc" onChange={set("description")} /></SearchField>
        <SearchField label="Taxable" id="s-tax"><NativeSelect id="s-tax" onChange={set("taxable")}><option value="" /><option value="yes">Yes</option><option value="no">No</option></NativeSelect></SearchField>
        <SearchField label="Entered By" id="s-by"><NativeSelect id="s-by" onChange={set("enteredById")}><option value="" />{o?.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</NativeSelect></SearchField>
      </LegacySearchBar>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Item Number</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Unit Price</TableHead><TableHead>Taxable</TableHead><TableHead className="w-16 text-right">Delete</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            <ListStatusRow colSpan={5} loading={q.isLoading} empty={!rows.length} emptyText="No Records Found" />
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.itemNumber}</TableCell>
                <TableCell><button type="button" disabled={!editable} onClick={() => setEdit({ item: r })} className="font-medium text-primary hover:underline disabled:text-foreground disabled:no-underline">{r.description}</button></TableCell>
                <TableCell className="text-right tabular-nums">{$(r.unitPrice)}</TableCell>
                <TableCell>{r.taxable ? "Yes" : "No"}</TableCell>
                <TableCell className="text-right"><Button size="icon-sm" variant="ghost" aria-label={`Delete ${r.description}`} disabled={!editable} onClick={() => setDel(r)}><Trash2Icon className="text-destructive" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <ListExportButtons onExport={() => exportCsv("merchandise-items.csv", ["Item Number", "Description", "Unit Price", "Quantity", "Taxable"], rows.map((r) => [r.itemNumber, r.description, r.unitPrice.toFixed(2), r.quantity, r.taxable ? "Yes" : "No"]))} />
      <ItemDialog item={edit?.item ?? null} open={!!edit} onOpenChange={(x) => !x && setEdit(null)} locations={o?.locations ?? []} />
      <ConfirmAction
        open={!!del}
        onOpenChange={(x) => !x && setDel(null)}
        title={`Delete ${del?.description}?`}
        description="Orders that sold it keep their lines. This can't be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          try {
            await client.staff.pos.itemDelete.mutate({ id: del!.id });
            await qc.invalidateQueries({ queryKey: trpc.staff.pos.items.queryKey() });
            toast.success("Item deleted");
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      />
    </div>
  );
}

/** Settings > Point Of Sale > Orders (OrdersSearchAddNew.aspx). */
export function PosOrders() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const can = useCan();
  const o = useQuery(trpc.staff.pos.options.queryOptions()).data;
  const pay = usePaymentMethods();
  const [quick, setQuick] = React.useState("");
  const [filters, setFilters] = React.useState<{ q?: string; from?: string; to?: string; payMethod?: string; locationId?: string; enteredById?: string }>({});
  const [adv, setAdv] = React.useState<typeof filters>({});
  const q = useQuery(trpc.staff.pos.orders.queryOptions(filters));
  const [del, setDel] = React.useState<{ id: string; number: number } | null>(null);
  const editable = can("Settings");
  const rows = q.data ?? [];
  const set = (k: keyof typeof filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setAdv((a) => ({ ...a, [k]: e.target.value || undefined }));

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex justify-end">
        {editable ? <Button asChild><Link href="/admin/settings/point-of-sale/orders/new"><PlusIcon /> New Order/Sale</Link></Button> : <Button disabled title={NO_PERMISSION}><PlusIcon /> New Order/Sale</Button>}
      </div>
      <LegacySearchBar placeholder="Pay Method, Order ID, PO # or customer" quick={quick} onQuickChange={setQuick} onSearch={(m) => setFilters(m === "quick" ? { q: quick.trim() || undefined } : adv)}>
        <SearchField label="Start Date" id="s-from"><Input id="s-from" type="date" onChange={set("from")} /></SearchField>
        <SearchField label="End Date" id="s-to"><Input id="s-to" type="date" onChange={set("to")} /></SearchField>
        <SearchField label="Pay Method" id="s-pay"><NativeSelect id="s-pay" onChange={set("payMethod")}><option value="" />{pay.options.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</NativeSelect></SearchField>
        <SearchField label="Location" id="s-loc"><NativeSelect id="s-loc" onChange={set("locationId")}><option value="" />{o?.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</NativeSelect></SearchField>
        <SearchField label="Entered By" id="s-by"><NativeSelect id="s-by" onChange={set("enteredById")}><option value="" />{o?.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</NativeSelect></SearchField>
      </LegacySearchBar>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead><TableHead>Date Entered</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Payment</TableHead><TableHead className="text-right">Balance</TableHead><TableHead>Pay Method</TableHead><TableHead>Location</TableHead><TableHead className="w-16 text-right">Delete</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <ListStatusRow colSpan={8} loading={q.isLoading} empty={!rows.length} emptyText="No Records Found" />
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell><Link href={`/admin/settings/point-of-sale/orders/${r.id}`} className="font-medium text-primary hover:underline">{r.number}</Link></TableCell>
                <TableCell>{legacyDate(r.enteredAt)}</TableCell>
                <TableCell className="text-right tabular-nums">{$(r.amount)}</TableCell>
                <TableCell className="text-right tabular-nums">{$(r.payment)}</TableCell>
                <TableCell className="text-right tabular-nums">{$(r.balance)}</TableCell>
                <TableCell>{payLabel(r.payMethod)}</TableCell>
                <TableCell>{r.location}</TableCell>
                <TableCell className="text-right"><Button size="icon-sm" variant="ghost" aria-label={`Delete order ${r.number}`} disabled={!editable} onClick={() => setDel({ id: r.id, number: r.number })}><Trash2Icon className="text-destructive" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <ListExportButtons onExport={() => exportCsv("orders.csv", ["Order ID", "Date Entered", "Amount", "Payment", "Balance", "Pay Method", "Location"], rows.map((r) => [r.number, legacyDate(r.enteredAt), r.amount.toFixed(2), r.payment.toFixed(2), r.balance.toFixed(2), payLabel(r.payMethod), r.location]))} />
      <ConfirmAction
        open={!!del}
        onOpenChange={(x) => !x && setDel(null)}
        title={`Delete order ${del?.number}?`}
        description="The order and its lines are removed. This can't be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          try {
            await client.staff.pos.orderDelete.mutate({ id: del!.id });
            await qc.invalidateQueries({ queryKey: trpc.staff.pos.orders.queryKey() });
            toast.success("Order deleted");
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      />
    </div>
  );
}

type Line = { key: number; itemId: string | null; description: string; unitPrice: number; quantity: number; taxPercent: number };
const pad = (n: number) => String(n).padStart(2, "0");
const localInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** New Order/Sale and Edit Order (OrdersModify.aspx). */
export function PosOrderForm({ id, defaultLocationId }: { id?: string; defaultLocationId?: string | null }) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();
  const router = useRouter();
  const can = useCan();
  const o = useQuery(trpc.staff.pos.options.queryOptions()).data;
  const ord = useQuery({ ...trpc.staff.pos.order.queryOptions({ id: id ?? "" }), enabled: !!id });
  const d = ord.data;
  const [locationId, setLocationId] = React.useState<string>("");
  const pay = usePaymentMethods(locationId || d?.locationId || defaultLocationId);
  const [lines, setLines] = React.useState<Line[] | null>(null);
  const [company, setCompany] = React.useState<string | null>(null);
  const [vehicle, setVehicle] = React.useState<string | null>(null);
  const [payment, setPayment] = React.useState<string | null>(null);
  const [pick, setPick] = React.useState({ itemId: "", unitPrice: "", quantity: "1", taxPercent: "" });
  const [saving, setSaving] = React.useState(false);
  const editable = can("Settings");
  const keyRef = React.useRef(1);

  const current: Line[] = lines ?? (d?.lines ?? []).map((l) => ({ ...l, key: keyRef.current++ }));
  const rows = current.map((l) => {
    const amount = round2(l.unitPrice * l.quantity);
    return { ...l, amount, tax: round2((amount * l.taxPercent) / 100) };
  });
  const amount = round2(rows.reduce((s, r) => s + r.amount, 0));
  const salesTax = round2(rows.reduce((s, r) => s + r.tax, 0));
  const total = round2(amount + salesTax);
  const paid = payment != null ? Number(payment) || 0 : d ? d.payment : total;

  function addItem() {
    const item = o?.items.find((i) => i.id === pick.itemId);
    if (!item) return toast.error("Choose an item");
    const qty = Math.max(1, Math.round(Number(pick.quantity) || 1));
    const price = pick.unitPrice === "" ? item.unitPrice : Number(pick.unitPrice) || 0;
    setLines([...current, { key: keyRef.current++, itemId: item.id, description: item.description, unitPrice: price, quantity: qty, taxPercent: item.taxable ? Number(pick.taxPercent) || 0 : 0 }]);
    setPick({ itemId: "", unitPrice: "", quantity: "1", taxPercent: pick.taxPercent });
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      const r = await client.staff.pos.orderSave.mutate({
        id,
        data: {
          poNumber: String(fd.get("poNumber") ?? ""), enteredAt: new Date(String(fd.get("enteredAt") ?? "")), payMethod: String(fd.get("payMethod") ?? ""),
          companyId: (company ?? d?.companyId) || null, customerName: String(fd.get("customerName") ?? ""), vehicleId: (vehicle ?? d?.vehicleId) || null,
          memo: String(fd.get("memo") ?? ""), locationId: String(fd.get("locationId") ?? ""), payment: paid,
          lines: current.map(({ itemId, description, unitPrice, quantity, taxPercent }) => ({ itemId, description, unitPrice, quantity, taxPercent })),
        },
      });
      await qc.invalidateQueries({ queryKey: trpc.staff.pos.orders.queryKey() });
      await qc.invalidateQueries({ queryKey: trpc.staff.pos.order.queryKey() });
      toast.success(id ? "Order saved" : `Order ${r.number} saved`);
      router.push("/admin/settings/point-of-sale/orders");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!o || (id && !d)) return <p className="p-6 text-sm text-muted-foreground">{ord.error ? errorMessage(ord.error) : "Loading…"}</p>;
  const item = o.items.find((i) => i.id === pick.itemId);

  return (
    <form key={id ?? "new"} onSubmit={save} className="space-y-4 p-4 md:p-6">
      <fieldset disabled={!editable} className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">{id ? `Order ${d!.number}` : "New Order/Sale"}</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <F label="PO Number" name="poNumber"><Input id="poNumber" name="poNumber" defaultValue={d?.poNumber ?? ""} /></F>
            <F label="Date Entered" name="enteredAt" required><Input id="enteredAt" name="enteredAt" type="datetime-local" defaultValue={localInput(d ? new Date(d.enteredAt) : new Date())} /></F>
            <F label="Location" name="locationId" required>
              <NativeSelect id="locationId" name="locationId" defaultValue={d?.locationId ?? defaultLocationId ?? o.locations[0]?.id} onChange={(e) => setLocationId(e.target.value)}>
                {o.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </NativeSelect>
            </F>
            <F label="Pay Method" name="payMethod">
              <NativeSelect id="payMethod" name="payMethod" defaultValue={d?.payMethod ?? pay.defaultMethod ?? ""}>
                <option value="" />
                {pay.options.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </NativeSelect>
            </F>
            <F label="Company" name="companyId"><SearchPicker id="companyId" items={o.companies.map((c) => ({ id: c.id, label: c.name }))} value={company ?? d?.companyId ?? ""} onChange={setCompany} placeholder="Type a company" /></F>
            <F label="Customer" name="customerName"><Input id="customerName" name="customerName" defaultValue={d?.customerName ?? ""} /></F>
            <F label="Vehicle" name="vehicleId"><SearchPicker id="vehicleId" items={o.vehicles} value={vehicle ?? d?.vehicleId ?? ""} onChange={setVehicle} placeholder="Type a unit #" /></F>
            <F label="Memo" name="memo" className="sm:col-span-2"><Textarea id="memo" name="memo" rows={2} defaultValue={d?.memo ?? ""} /></F>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Order Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_8rem_6rem_7rem_auto]">
              <F label="Choose Item" name="pickItem">
                <NativeSelect id="pickItem" value={pick.itemId} onChange={(e) => { const it = o.items.find((i) => i.id === e.target.value); setPick({ ...pick, itemId: e.target.value, unitPrice: it ? it.unitPrice.toFixed(2) : "" }); }}>
                  <option value="">Please Select</option>
                  {o.items.map((i) => <option key={i.id} value={i.id}>{i.itemNumber ? `${i.itemNumber} — ` : ""}{i.description}</option>)}
                </NativeSelect>
              </F>
              <F label="Unit Price" name="pickPrice"><Input id="pickPrice" inputMode="decimal" value={pick.unitPrice} onChange={(e) => setPick({ ...pick, unitPrice: e.target.value })} /></F>
              <F label="Quantity" name="pickQty"><Input id="pickQty" type="number" min={1} value={pick.quantity} onChange={(e) => setPick({ ...pick, quantity: e.target.value })} /></F>
              <F label="Tax Amount %" name="pickTax"><Input id="pickTax" inputMode="decimal" value={pick.taxPercent} disabled={item ? !item.taxable : false} placeholder={item && !item.taxable ? "Not taxable" : "e.g. 12"} onChange={(e) => setPick({ ...pick, taxPercent: e.target.value })} /></F>
              <Button type="button" variant="outline" onClick={addItem}><PlusIcon /> Add Item</Button>
            </div>
            {!o.items.length && <p className="text-sm text-muted-foreground">No merchandise items yet — add them in <Link href="/admin/settings/point-of-sale/items" className="text-primary hover:underline">Merchandise Items</Link>.</p>}
            <Table>
              <TableHeader>
                <TableRow><TableHead>Item</TableHead><TableHead className="text-right">Unit Price</TableHead><TableHead className="text-right">Quantity</TableHead><TableHead className="text-right">Tax %</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Tax</TableHead><TableHead className="w-10" /></TableRow>
              </TableHeader>
              <TableBody>
                <ListStatusRow colSpan={7} loading={false} empty={!rows.length} emptyText="No items on this order yet." />
                {rows.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell>{r.description}</TableCell>
                    <TableCell className="text-right tabular-nums">{$(r.unitPrice)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.quantity}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.taxPercent}</TableCell>
                    <TableCell className="text-right tabular-nums">{$(r.amount)}</TableCell>
                    <TableCell className="text-right tabular-nums">{$(r.tax)}</TableCell>
                    <TableCell><Button type="button" size="icon-sm" variant="ghost" aria-label={`Remove ${r.description}`} onClick={() => setLines(current.filter((x) => x.key !== r.key))}><XIcon /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow><TableCell colSpan={4} className="text-right">Amount:</TableCell><TableCell colSpan={3} className="tabular-nums">{$(amount)}</TableCell></TableRow>
                <TableRow><TableCell colSpan={4} className="text-right">Sales Tax:</TableCell><TableCell colSpan={3} className="tabular-nums">{$(salesTax)}</TableCell></TableRow>
                <TableRow><TableCell colSpan={4} className="text-right font-semibold">Total Sale:</TableCell><TableCell colSpan={3} className="font-semibold tabular-nums">{$(total)}</TableCell></TableRow>
                <TableRow>
                  <TableCell colSpan={4} className="text-right">Payment:</TableCell>
                  <TableCell colSpan={3}><Input aria-label="Payment" inputMode="decimal" className="h-8 w-32" value={payment ?? paid.toFixed(2)} onChange={(e) => setPayment(e.target.value)} /></TableCell>
                </TableRow>
                <TableRow><TableCell colSpan={4} className="text-right">Balance:</TableCell><TableCell colSpan={3} className="tabular-nums">{$(round2(total - paid))}</TableCell></TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      </fieldset>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" asChild><Link href="/admin/settings/point-of-sale/orders">Cancel</Link></Button>
        <Button type="submit" disabled={saving || !editable} title={editable ? undefined : NO_PERMISSION}>{saving ? "Saving…" : "Save"}</Button>
      </div>
    </form>
  );
}
