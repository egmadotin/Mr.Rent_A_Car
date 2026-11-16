import { TRPCError } from "@trpc/server";

/**
 * VIN decoding (client request, Nov 17): the vehicle's year, make, model, engine and standard specs from a live external
 * source, so new model years are covered as manufacturers publish them — NHTSA vPIC (vpic.nhtsa.dot.gov), free, no key,
 * fed by the manufacturers' VIN decoding data. Only the VIN is sent.
 */
const VPIC = "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended";

export const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

export type DecodedVin = {
  vin: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  body: string | null;
  doors: number | null;
  seats: number | null;
  cylinders: number | null;
  displacementL: number | null;
  horsepower: number | null;
  engine: string | null;
  fuel: string | null;
  drive: string | null;
  transmission: "AUTOMATIC" | "MANUAL" | null;
  powerTrain: "FOUR_BY_TWO" | "FOUR_BY_FOUR" | null;
  /** vPIC's note when the VIN looks wrong (bad check digit…) but still decoded */
  warning: string | null;
};

const num = (s: unknown) => {
  const n = parseFloat(String(s ?? ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const str = (s: unknown) => {
  const t = String(s ?? "").trim();
  return t && t !== "Not Applicable" ? t : null;
};
/** "TOYOTA" → "Toyota", keeps short brands as written (BMW, GMC, KIA → Kia). */
const titleCase = (s: string | null) =>
  s && (s.length <= 3 ? s.toUpperCase() : s.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_m, a: string, b: string) => a + b.toUpperCase()));

export async function decodeVin(raw: string): Promise<DecodedVin> {
  const vin = raw.trim().toUpperCase();
  if (!VIN_RE.test(vin)) throw new TRPCError({ code: "BAD_REQUEST", message: "A VIN has 17 letters and digits (no I, O or Q)." });
  let r: Record<string, string>;
  try {
    const res = await fetch(`${VPIC}/${vin}?format=json`, { signal: AbortSignal.timeout(12_000), headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = (await res.json()) as { Results?: Record<string, string>[] };
    r = j.Results?.[0] ?? {};
  } catch (e) {
    throw new TRPCError({ code: "BAD_GATEWAY", message: `The VIN lookup service didn't answer (${(e as Error).message}). Try again, or fill the details by hand.` });
  }
  const make = titleCase(str(r.Make));
  const model = str(r.Model);
  if (!make && !model) throw new TRPCError({ code: "NOT_FOUND", message: str(r.ErrorText) ?? "No vehicle found for that VIN." });
  const cylinders = num(r.EngineCylinders);
  const displacementL = num(r.DisplacementL);
  const fuel = str(r.FuelTypePrimary);
  const electric = /electric/i.test(fuel ?? "");
  const engine = [displacementL ? `${displacementL.toFixed(1)}L` : null, cylinders ? `${cylinders}-cyl` : null, str(r.EngineConfiguration), electric ? "Electric" : null, str(r.OtherEngineInfo)]
    .filter(Boolean)
    .join(" ") || null;
  const drive = str(r.DriveType);
  const trans = str(r.TransmissionStyle);
  const code = String(r.ErrorCode ?? "0").split(",")[0]!.trim();
  return {
    vin,
    year: num(r.ModelYear),
    make,
    model,
    trim: str(r.Trim) ?? str(r.Series),
    body: str(r.BodyClass),
    doors: num(r.Doors),
    seats: num(r.Seats),
    cylinders,
    displacementL,
    horsepower: num(r.EngineHP) ? Math.round(num(r.EngineHP)!) : null,
    engine,
    fuel,
    drive,
    transmission: trans ? (/manual/i.test(trans) ? "MANUAL" : "AUTOMATIC") : null,
    powerTrain: drive ? (/4x4|4wd|awd|all[- ]wheel|four/i.test(drive) ? "FOUR_BY_FOUR" : "FOUR_BY_TWO") : null,
    warning: code !== "0" ? str(r.ErrorText) : null,
  };
}
