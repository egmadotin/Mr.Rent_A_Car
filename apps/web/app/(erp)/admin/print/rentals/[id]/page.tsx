import { notFound } from "next/navigation";
import { LocalDateTime } from "@mrac/ui/components/local-time";
import { date, fuel, fullName, money } from "@mrac/ui/lib/format";
import { api } from "../../../../_lib/session";
import { PrintButton } from "../../_components/print-button";
import { TemplatePicker } from "../../_components/template-picker";

export const metadata = { title: "Print rental" };

/**
 * "Print Rental/Invoice": the rental printed with a template from Settings > Rental Contracts & Invoices (`?t=` = the
 * "Please Select Rental Printout" name; default = the location's default agreement template). Falls back to the built-in
 * layout when no template exists.
 */
export default async function PrintRentalPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const { id } = await params;
  const { t: templateName } = await searchParams;
  const staff = await api();
  const data = await staff.rental.byId({ rentalId: id }).catch(() => null);
  if (!data) notFound();
  const { rental: r, totals: t } = data;
  const [doc, templates] = await Promise.all([
    staff.template.renderRental({ rentalId: id, name: templateName || undefined }),
    staff.template.list({ kind: "AGREEMENT", locationId: r.checkOutLocationId, activeOnly: true }),
  ]);
  if (doc.html)
    return (
      <div className="bg-white text-black">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-3 print:hidden">
          <TemplatePicker current={doc.name ?? ""} names={templates.map((x) => x.name)} />
          <PrintButton />
        </div>
        {/* staff-authored template HTML (Settings > Rentals & Invoices), filled with this rental's data */}
        <div className="mx-auto max-w-[8.5in] p-4 print:p-0" dangerouslySetInnerHTML={{ __html: doc.html }} />
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl space-y-6 bg-background p-8 text-sm print:max-w-none print:p-0">
      <div className="flex items-start justify-between print:hidden">
        <p className="text-muted-foreground">Print preview</p>
        <PrintButton />
      </div>

      <header className="flex items-start justify-between border-b pb-4">
        <div>
          <h1 className="text-xl font-bold">Mr Rent A Car</h1>
          <p className="text-muted-foreground">{r.checkOutLocation.name}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold">Rental Agreement #{r.raNumber}</p>
          <p className="text-muted-foreground">Status: {r.status.toLowerCase()}</p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-6">
        <div>
          <h2 className="mb-1 font-semibold">Renter</h2>
          <p>{fullName(r.customer)}</p>
          <p>{[r.customer.address1, r.customer.city, r.customer.province, r.customer.postal].filter(Boolean).join(", ")}</p>
          <p>{r.customer.phone}</p>
          <p>Licence {r.customer.licenseNumber ?? "—"} (exp. {date(r.customer.licenseExpiry)})</p>
          {r.drivers.length > 0 && <p>Additional drivers: {r.drivers.map((d) => fullName(d.customer)).join(", ")}</p>}
        </div>
        <div>
          <h2 className="mb-1 font-semibold">Vehicle</h2>
          <p>
            {r.vehicle.year} {r.vehicle.make.name} {r.vehicle.model.name} ({r.vehicle.assignedId})
          </p>
          <p>Plate {r.vehicle.licenseNumber} · {r.vehicle.colour}</p>
          <p>Odometer out {r.odometerOut.toLocaleString()} · in {r.odometerIn?.toLocaleString() ?? "—"}</p>
          <p>Fuel out {fuel(r.fuelOut)} · in {fuel(r.fuelIn)}</p>
        </div>
        <div>
          <h2 className="mb-1 font-semibold">Pickup</h2>
          <p><LocalDateTime value={r.checkOutAt} /></p>
          <p>{r.checkOutLocation.name}</p>
        </div>
        <div>
          <h2 className="mb-1 font-semibold">Return</h2>
          <p><LocalDateTime value={r.checkedInAt ?? r.expectedReturnAt} /></p>
          <p>{r.checkInLocation.name}</p>
        </div>
      </section>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b text-left">
            <th className="py-1">Charge</th>
            <th className="py-1 text-right">Unit</th>
            <th className="py-1 text-right">Rate</th>
            <th className="py-1 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {r.chargeLines.map((l) => (
            <tr key={l.id} className="border-b border-border/50">
              <td className="py-1">{l.name}</td>
              <td className="py-1 text-right">{Number(l.units) || ""}</td>
              <td className="py-1 text-right">{l.kind === "TAX" && l.tax?.kind !== "AMOUNT" ? `${Number(l.rate)}%` : Number(l.rate) ? money(l.rate) : ""}</td>
              <td className="py-1 text-right">{money(l.total)}</td>
            </tr>
          ))}
          {(
            [
              ["Sub Total", t.subTotal],
              ["Total", t.total],
              ["Total Payments", t.totalPayments],
              ["Balance", t.balance],
            ] as const
          ).map(([label, v]) => (
            <tr key={label} className="font-semibold">
              <td colSpan={3} className="py-1 text-right">{label}</td>
              <td className="py-1 text-right">{money(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <footer className="grid grid-cols-2 gap-10 pt-10">
        <div className="border-t pt-1 text-muted-foreground">Renter signature</div>
        <div className="border-t pt-1 text-muted-foreground">Date</div>
      </footer>
    </div>
  );
}
