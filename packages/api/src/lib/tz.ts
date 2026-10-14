// Copy of packages/ui/src/lib/tz.ts (the API package does not depend on @mrac/ui). Keep in sync.
/**
 * Business-time helpers. Bookings are Canadian local time at the location (Surrey/Coquitlam: Pacific,
 * YYC: Mountain), regardless of where the staff member or customer is. Everything that shows or reads a
 * date-time goes through these, so server and browser render the same text.
 */
export const BUSINESS_TZ = "America/Vancouver";

type Parts = { y: number; m: number; d: number; h: number; mi: number; s: number; wd: number };
const fmtCache = new Map<string, Intl.DateTimeFormat>();
function parts(date: Date, tz: string): Parts {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short",
    });
    fmtCache.set(tz, f);
  }
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(String(p.weekday));
  return { y: +p.year!, m: +p.month!, d: +p.day!, h: +p.hour! % 24, mi: +p.minute!, s: +p.second!, wd };
}

/** Offset of `tz` from UTC at `date`, in ms (e.g. Pacific daylight time = -7h). */
export function tzOffsetMs(date: Date, tz: string) {
  const p = parts(date, tz);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(date.getTime() / 1000) * 1000;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Date → "YYYY-MM-DDTHH:mm" wall-clock time in `tz` (value for <input type="datetime-local">). */
export function toZonedInput(d: Date | string | null | undefined, tz: string = BUSINESS_TZ) {
  if (!d) return "";
  const x = new Date(d);
  if (Number.isNaN(+x)) return "";
  const p = parts(x, tz);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`;
}

/** "YYYY-MM-DDTHH:mm" wall-clock time in `tz` → Date (the real instant). Invalid → Invalid Date. */
export function fromZonedInput(s: string | null | undefined, tz: string = BUSINESS_TZ) {
  const m = String(s ?? "").match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!m) return new Date(NaN);
  const guess = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +(m[4] ?? 0), +(m[5] ?? 0));
  let t = guess - tzOffsetMs(new Date(guess), tz);
  t = guess - tzOffsetMs(new Date(t), tz); // second pass handles DST edges
  return new Date(t);
}

/** Midnight (start of the calendar day) in `tz` for the day containing `d`. */
export function startOfDayIn(d: Date, tz: string = BUSINESS_TZ) {
  return fromZonedInput(toZonedInput(d, tz).slice(0, 10), tz);
}

/** 0 = Sunday … 6 = Saturday, in `tz`. */
export function weekdayIn(d: Date, tz: string = BUSINESS_TZ) {
  return parts(d, tz).wd;
}

/** Month (1-12) and day in `tz` — for season windows. */
export function monthDayIn(d: Date, tz: string = BUSINESS_TZ) {
  const p = parts(d, tz);
  return { month: p.m, day: p.d };
}

/** "now" as an input value in `tz`, rounded up to the next hour. */
export function nextHourInput(tz: string = BUSINESS_TZ, addMs = 0) {
  const p = parts(new Date(Date.now() + 3_600_000 + addMs), tz);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:00`;
}

/** The location-local calendar date of `d`, as UTC midnight — comparable with @db.Date columns. */
export function localDateAsUtc(d: Date, tz: string = BUSINESS_TZ) {
  return new Date(`${toZonedInput(d, tz).slice(0, 10)}T00:00:00.000Z`);
}
