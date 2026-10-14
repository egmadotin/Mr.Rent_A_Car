"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertCircleIcon, Loader2Icon, ShieldCheckIcon, UsersIcon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Badge } from "@mrac/ui/components/badge";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@mrac/ui/components/card";
import { toast } from "@mrac/ui/components/sonner";
import { date } from "@mrac/ui/lib/format";
import { REGION_OPTIONS } from "@mrac/ui/lib/regions";
import { ConfirmAction } from "../../../../_components/confirm-action";
import {
  CheckField,
  Field,
  FormErrorsContext,
  SelectField,
  TextareaField,
  errorMessage,
  fieldErrorsOf,
  formToObject,
} from "../../../../_components/form";

export type CustomerInitial = Record<string, string | boolean | null | undefined>;

const SECTIONS = [
  ["personal", "Personal"],
  ["contact", "Contact & address"],
  ["licence", "Licence & identity"],
  ["insurance", "Insurance"],
  ["work", "Company & work"],
  ["flags", "Memberships & flags"],
] as const;

export function CustomerForm({
  customerId,
  initial = {},
  verifiedNote,
  defaultLocationId,
}: {
  customerId?: string;
  initial?: CustomerInitial;
  /** "Verified manually by X on …" — shown next to the checkbox when editing */
  verifiedNote?: string;
  defaultLocationId?: string;
}) {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const router = useRouter();
  const editing = !!customerId;
  const o = useQuery(trpc.staff.customer.formOptions.queryOptions()).data;
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [confirmDup, setConfirmDup] = React.useState<Record<string, unknown> | null>(null);

  // live duplicate check while typing (create only)
  const [dupKey, setDupKey] = React.useState({ firstName: "", lastName: "", phone: "", email: "", licenseNumber: "" });
  const formRef = React.useRef<HTMLFormElement>(null);
  const onChange = () => {
    if (editing || !formRef.current) return;
    const v = formToObject(formRef.current) as Record<string, string>;
    const next = { firstName: v.firstName ?? "", lastName: v.lastName ?? "", phone: v.phone ?? "", email: v.email ?? "", licenseNumber: v.licenseNumber ?? "" };
    if (JSON.stringify(next) !== JSON.stringify(dupKey)) setDupKey(next);
  };
  const [debouncedKey, setDebouncedKey] = React.useState(dupKey);
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedKey(dupKey), 400);
    return () => clearTimeout(t);
  }, [dupKey]);
  const dups = useQuery({ ...trpc.staff.customer.duplicates.queryOptions(debouncedKey), enabled: !editing && debouncedKey.lastName.length >= 2 });

  const val = (k: string) => (initial[k] == null ? undefined : String(initial[k]));
  const chk = (k: string, dflt = false) => (initial[k] == null ? dflt : Boolean(initial[k]));

  async function save(v: Record<string, unknown>, ignoreDuplicates = false) {
    setPending(true);
    setErrors({});
    setFormError(null);
    try {
      const res = editing
        ? await client.staff.customer.update.mutate({ customerId: customerId!, data: v as never })
        : await client.staff.customer.create.mutate({ data: v as never, ignoreDuplicates, enteredLocationId: defaultLocationId });
      toast.success(editing ? "Customer updated" : "Customer added");
      router.push(`/admin/customers/${res.id}`);
    } catch (e) {
      if (errorMessage(e) === "POSSIBLE_DUPLICATE") return setConfirmDup(v);
      const fe = fieldErrorsOf(e);
      setErrors(fe);
      const msg = Object.keys(fe).length ? "Fix the highlighted fields." : errorMessage(e);
      setFormError(msg);
      toast.error(msg);
    } finally {
      setPending(false);
    }
  }

  if (!o) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  const opts = (xs: { id: string; name: string }[]) => xs.map((x) => ({ value: x.id, label: x.name }));

  return (
    <FormErrorsContext.Provider value={errors}>
      <form
        ref={formRef}
        noValidate
        onChange={onChange}
        onSubmit={(e) => {
          e.preventDefault();
          save(formToObject(e.currentTarget));
        }}
        className="grid gap-6 p-4 md:p-6 lg:grid-cols-[12rem_minmax(0,1fr)]"
      >
        <nav aria-label="Form sections" className="hidden lg:block">
          <ol className="sticky top-6 space-y-1 text-sm">
            {SECTIONS.map(([id, title]) => (
              <li key={id}>
                <a href={`#${id}`} className="block rounded-md px-2 py-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground">{title}</a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-6">
          {formError && (
            <div role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircleIcon className="size-4" /> {formError}
            </div>
          )}

          <Section id="personal" title="Personal">
            <SelectField label="Title" name="title" options={["Mr", "Mrs", "Ms", "Miss", "Dr"]} placeholder="—" defaultValue={val("title")} />
            <Field label="First name" name="firstName" required defaultValue={val("firstName")} />
            <Field label="Middle name" name="middleName" defaultValue={val("middleName")} />
            <Field label="Last name" name="lastName" required defaultValue={val("lastName")} />
            <SelectField label="Gender" name="gender" options={["Male", "Female"]} placeholder="—" defaultValue={val("gender")} />
            <Field label="Date of birth" name="birthDate" type="date" defaultValue={val("birthDate")} />
            <SelectField
              label="Default location"
              name="defaultLocationId"
              options={o.locations.map((l) => ({ value: l.id, label: l.isActive ? l.name : `${l.name} (inactive)` }))}
              placeholder="—"
              defaultValue={val("defaultLocationId") ?? defaultLocationId}
            />
            <SelectField label="Region" name="regionId" options={opts(o.regions)} placeholder="—" defaultValue={val("regionId")} />
          </Section>

          {!editing && (dups.data?.length ?? 0) > 0 && (
            <div className="rounded-lg border border-warning/50 bg-warning/10 p-3">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium"><UsersIcon className="size-4" /> This person may already be a customer:</p>
              <ul className="divide-y rounded-md border bg-card text-sm">
                {dups.data!.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-2">
                    <span>
                      <span className="font-medium">{c.firstName} {c.lastName}</span>{" "}
                      <span className="text-muted-foreground">{[c.phone, c.email, c.licenseNumber && `Lic ${c.licenseNumber}`, c.birthDate && `DOB ${date(c.birthDate)}`].filter(Boolean).join(" · ")}</span>{" "}
                      {c.isUndesired && <Badge variant="destructive">Undesired</Badge>}
                    </span>
                    <Button type="button" size="sm" variant="outline" asChild><Link href={`/admin/customers/${c.id}`}>Open</Link></Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Section id="contact" title="Contact & address">
            <Field label="Phone" name="phone" type="tel" defaultValue={val("phone")} />
            <Field label="Cell phone" name="cellPhone" type="tel" defaultValue={val("cellPhone")} />
            <Field label="Local phone" name="localPhone" type="tel" defaultValue={val("localPhone")} />
            <Field label="Email" name="email" type="email" defaultValue={val("email")} />
            <Field label="Emergency contact phone" name="emergencyContactPhone" type="tel" defaultValue={val("emergencyContactPhone")} />
            <div />
            <Field label="Address" name="address1" defaultValue={val("address1")} />
            <Field label="Address 2" name="address2" defaultValue={val("address2")} />
            <Field label="City" name="city" defaultValue={val("city")} />
            <SelectField label="Province / state" name="province" options={REGION_OPTIONS} placeholder="—" defaultValue={val("province")} />
            <Field label="Postal / zip" name="postal" defaultValue={val("postal")} />
            <Field label="Country" name="country" defaultValue={val("country")} />
          </Section>

          <Section id="licence" title="Licence & identity" description="Entered by hand today. Plustek (counter scan) and Plaid (online) fill these automatically once connected.">
            <Field label="Driver's licence #" name="licenseNumber" defaultValue={val("licenseNumber")} />
            <Field label="Licence expiration" name="licenseExpiry" type="date" defaultValue={val("licenseExpiry")} />
            <SelectField label="Licence province / state" name="licenseProvince" options={REGION_OPTIONS} placeholder="—" defaultValue={val("licenseProvince")} />
            <Field label="Licence country" name="licenseCountry" defaultValue={val("licenseCountry")} />
            <SelectField label="Motorcycle licensed" name="motorcycleLicensed" options={[{ value: "true", label: "Yes" }, { value: "false", label: "No" }]} placeholder="—" defaultValue={val("motorcycleLicensed")} />
            <Field label="Passport #" name="passportNumber" defaultValue={val("passportNumber")} />
            <div className="space-y-1 sm:col-span-2 xl:col-span-3">
              <CheckField label="Licence / ID validated" name="identityVerified" defaultChecked={chk("identityVerified")} />
              {verifiedNote && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheckIcon className="size-3.5" /> {verifiedNote}</p>}
            </div>
            <CheckField label="Check Yoti verification" name="checkYotiVerification" defaultChecked={chk("checkYotiVerification")} />
          </Section>

          <Section id="insurance" title="Insurance">
            <Field label="Insurance company" name="insuranceCompany" defaultValue={val("insuranceCompany")} />
            <Field label="Policy #" name="insurancePolicyNumber" defaultValue={val("insurancePolicyNumber")} />
            <Field label="Policy holder name" name="insurancePolicyHolder" defaultValue={val("insurancePolicyHolder")} />
            <SelectField label="Insurance type" name="insuranceType" options={[{ value: "LIABILITY_ONLY", label: "Liability Only" }, { value: "FULL_COVERAGE", label: "Full Coverage" }]} placeholder="—" defaultValue={val("insuranceType")} />
            <Field label="Insurance expiration" name="insuranceExpiry" type="date" defaultValue={val("insuranceExpiry")} />
            <Field label="Insurance phone" name="insurancePhone" type="tel" defaultValue={val("insurancePhone")} />
            <Field label="Insurance fax" name="insuranceFax" type="tel" defaultValue={val("insuranceFax")} />
            <Field label="Approved by" name="approvedBy" defaultValue={val("approvedBy")} />
          </Section>

          <Section id="work" title="Company & work" optional>
            <SelectField label="Company / corporate" name="companyId" options={opts(o.companies)} placeholder="—" defaultValue={val("companyId")} />
            <Field label="Company phone" name="companyPhone" type="tel" defaultValue={val("companyPhone")} />
            <Field label="Job position" name="jobPosition" defaultValue={val("jobPosition")} />
            <SelectField label="Source of referral" name="referralId" options={opts(o.referrals)} placeholder="—" defaultValue={val("referralId")} />
            <Field label="DBA name" name="dbaName" defaultValue={val("dbaName")} />
            <Field label="Tax ID" name="taxId" defaultValue={val("taxId")} />
            <Field label="HST #" name="hstNumber" defaultValue={val("hstNumber")} />
          </Section>

          <Section id="flags" title="Memberships & flags">
            <Field label="AAA membership #" name="aaaMembershipNumber" defaultValue={val("aaaMembershipNumber")} />
            <Field label="Frequent traveler ID" name="frequentTravelerId" defaultValue={val("frequentTravelerId")} />
            <Field label="Band name" name="bandName" defaultValue={val("bandName")} hint="Pending client review" />
            <Field label="PIN" name="pin" defaultValue={val("pin")} autoComplete="off" hint="Pending client review" />
            <Field label="SSN" name="ssn" defaultValue={val("ssn")} autoComplete="off" hint="Sensitive — pending client review" />
            <div />
            <div className="grid gap-2 sm:col-span-2 sm:grid-cols-3 xl:col-span-3">
              <CheckField label="Active" name="isActive" defaultChecked={chk("isActive", true)} />
              <CheckField label="Preferred customer" name="isPreferred" defaultChecked={chk("isPreferred")} />
              <CheckField label="Club member" name="isClubMember" defaultChecked={chk("isClubMember")} />
              <CheckField label="Undesired (do not rent)" name="isUndesired" defaultChecked={chk("isUndesired")} />
              <CheckField label="Unsubscribed from email marketing" name="unsubscribedFromMarketing" defaultChecked={chk("unsubscribedFromMarketing")} />
              <CheckField label="All vehicle bodies" name="allVehicleBodies" defaultChecked={chk("allVehicleBodies")} />
            </div>
            <TextareaField label={editing ? "Add memo" : "Memo"} name="memo" rows={2} className="sm:col-span-2 xl:col-span-3" />
            <CheckField label="Always display memo as popup" name="memoShowAsPopup" />
          </Section>

          <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
            <Button type="button" variant="outline" asChild><Link href={editing ? `/admin/customers/${customerId}` : "/admin/customers"}>Cancel</Link></Button>
            <Button type="submit" disabled={pending}>{pending && <Loader2Icon className="animate-spin" />}{editing ? "Save changes" : "Add customer"}</Button>
          </div>
        </div>
      </form>

      <ConfirmAction
        open={confirmDup !== null}
        onOpenChange={(o) => !o && setConfirmDup(null)}
        title="Possible duplicate"
        description="A customer with the same name, phone, email or licence already exists. Create a new record anyway?"
        confirmLabel="Create anyway"
        onConfirm={async () => {
          const v = confirmDup!;
          setConfirmDup(null);
          await save(v, true);
        }}
      />
    </FormErrorsContext.Provider>
  );
}

function Section({ id, title, description, optional, children }: { id: string; title: string; description?: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-6">
      <CardHeader className="flex-col items-start gap-1">
        <CardTitle className="flex items-center gap-2 text-base">{title}{optional && <span className="text-xs font-normal text-muted-foreground">optional</span>}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</CardContent>
    </Card>
  );
}
