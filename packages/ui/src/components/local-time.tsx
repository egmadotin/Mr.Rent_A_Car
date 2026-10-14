import { date as fmtDate, dateTime as fmtDateTime } from "../lib/format";

/** Timestamp in business (location) time — same text on server and client. */
export function LocalDateTime({ value, dateOnly, timeZone }: { value: Date | string | null | undefined; dateOnly?: boolean; timeZone?: string }) {
  if (!value) return <>—</>;
  return <time dateTime={new Date(value).toISOString()}>{dateOnly ? fmtDate(value) : fmtDateTime(value, timeZone)}</time>;
}
