"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { DownloadIcon, UploadIcon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent } from "@mrac/ui/components/card";
import { Checkbox } from "@mrac/ui/components/checkbox";
import { Label } from "@mrac/ui/components/label";
import { NativeSelect } from "@mrac/ui/components/native-select";
import { toast } from "@mrac/ui/components/sonner";
import { errorMessage } from "../../../../_components/form";
import { NO_PERMISSION, useCan } from "../../../../_components/permissions";

/**
 * Settings > Import Data (Customer / Company / Rate / Referral / Vehicle / Model Import): RentCentric's CSV templates,
 * read in the browser and imported row by row; bad rows are listed and the rest still import.
 */

const TYPES = {
  customers: { label: "Customer Import", file: "CustomersUploads.csv", cols: "First Name,Last Name,Address,Address2,City,State,Zip,Country,Phone,Email,License Number,License Exp,License State,date of birth,Account Holder,CCType,CCNumber,CCExpMonth,CCExpYear", note: "Card columns are ignored — card numbers are never stored." },
  companies: { label: "Company Import", file: "CompanyUpload.csv", cols: "CompanyName,CompanyType,CompanyCode,Address1,Address2,City,State,Zip,Country,Phone,Fax,Email", note: "" },
  rates: { label: "Rate Import", file: "RatesUploads.csv", cols: "RateCode,MileageCharge,VehicleType,CalculationType,RateType,MinDays,MaxDays,PickupDay,DropoffDay,PickupTime,DropoffTime,GraceMinutes,HourlyRate,DailyRate,ExtraDailyRate,WeeklyRate,MonthlyRate,MileageAllowedDaily,MileageAllowedWeekly,MileageAllowedMonthly,EffectiveDate,EndDate,IsActive,ValuePricing,WebCustomer,CompanyCode,MinHours,MaxHours,AvailableOn,SkipOnStart,MinimumRentalDays,Seasons", note: "One row per rate code and vehicle type, imported to the chosen location." },
  referrals: { label: "Referral Import", file: "ReferralsUpload.csv", cols: "Description,FullName,Email,Phone,Fax,Memo,Address,Zip,CommissionType,CommissionAmount,Commissionable", note: "" },
  vehicles: { label: "Vehicle Import", file: "VehiclesUploads.csv", cols: "VehicleID,Year,Make,Model,VehicleType,VINNumber,Status,Odometer,OriginalOdometer,Colour,Price,LicenseNumber,LicenseExpiry,LicenseState,TankSize,Memo,Doors,FuelLevel,FuelType,Transmission,Body,ServiceInterval,Active", note: "Vehicles are added to the chosen location; makes and models are created when new." },
  models: { label: "Model Import", file: "ModelUpload.csv", cols: "Make,Model", note: "" },
} as const;
type Type = keyof typeof TYPES;

/** RFC 4180 CSV: quoted fields, "" escapes, commas / newlines inside quotes. */
function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((x) => x.trim()));
  if (!head) return [];
  const keys = head.map((h) => h.replace(/^﻿/, "").trim());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ""])));
}

export function ImportData() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const can = useCan();
  const locations = useQuery(trpc.staff.settings.lookups.queryOptions()).data?.locations ?? [];
  const [type, setType] = React.useState<Type>("customers");
  const [locationId, setLocationId] = React.useState("");
  const [update, setUpdate] = React.useState(false);
  const [rows, setRows] = React.useState<Record<string, string>[] | null>(null);
  const [fileName, setFileName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{ created: number; updated: number; skipped: number; errors: { row: number; message: string }[] } | null>(null);
  const t = TYPES[type];
  const firstLocation = locations[0]?.id ?? "";
  React.useEffect(() => setLocationId((x) => x || firstLocation), [firstLocation]);

  function template() {
    const blob = new Blob([`${t.cols}\r\n`], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = t.file;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function run() {
    if (!rows?.length) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await client.staff.imports.run.mutate({ type, locationId, update, rows });
      setResult(res);
      toast.success(`Imported: ${res.created} added, ${res.updated} updated, ${res.skipped} skipped${res.errors.length ? `, ${res.errors.length} with errors` : ""}`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <Card className="max-w-3xl">
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="im-type">Import</Label>
              <NativeSelect id="im-type" value={type} onChange={(e) => { setType(e.target.value as Type); setRows(null); setResult(null); setFileName(""); }}>
                {Object.entries(TYPES).map(([k, x]) => <option key={k} value={k}>{x.label}</option>)}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="im-loc">Location</Label>
              <NativeSelect id="im-loc" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </NativeSelect>
            </div>
          </div>
          <div className="rounded-md bg-muted/50 p-3 text-sm">
            <p className="font-medium">Import Instructions:</p>
            <p className="text-muted-foreground">
              Download the template <button type="button" onClick={template} className="inline-flex items-center gap-1 text-primary hover:underline"><DownloadIcon className="size-3.5" />{t.file}</button>, fill one row per record (keep the first row of column names), save as CSV and select it below. {t.note}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
              <UploadIcon className="size-4" /> {fileName || "Select import file"}
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  setFileName(f.name);
                  setResult(null);
                  const parsed = parseCsv(await f.text());
                  setRows(parsed);
                  if (!parsed.length) toast.error("No rows found in that file.");
                }}
              />
            </label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={update} onChange={(e) => setUpdate(e.target.checked)} /> Update Existing Records</label>
          </div>
          {rows && rows.length > 0 && (
            <p className="text-sm">{rows.length.toLocaleString()} row(s) ready. Columns: <span className="text-muted-foreground">{Object.keys(rows[0]!).join(", ")}</span></p>
          )}
          <div className="flex justify-end">
            <Button onClick={run} disabled={!rows?.length || busy || !can("Settings") || !locationId} title={can("Settings") ? undefined : NO_PERMISSION}>{busy ? "Importing…" : "Import"}</Button>
          </div>
        </CardContent>
      </Card>
      {result && (
        <Card className="max-w-3xl">
          <CardContent className="space-y-2 text-sm">
            <p><b>{result.created}</b> added · <b>{result.updated}</b> updated · <b>{result.skipped}</b> skipped (already there){result.errors.length ? <> · <b className="text-destructive">{result.errors.length}</b> not imported</> : null}</p>
            {result.errors.length > 0 && (
              <ul className="max-h-64 list-disc overflow-y-auto pl-5 text-destructive">
                {result.errors.map((e) => <li key={e.row}>Row {e.row}: {e.message}</li>)}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
