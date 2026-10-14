import { Badge } from "@mrac/ui/components/badge";

/** Labels match the legacy list ("Honored" = turned into a rental). */
export const RESERVATION_STATUS = {
  TENTATIVE: { label: "Tentative", variant: "warning" },
  CONFIRMED: { label: "Confirmed", variant: "info" },
  CHECKED_OUT: { label: "Honored", variant: "success" },
  CHECKED_IN: { label: "Checked in", variant: "muted" },
  CANCELLED: { label: "Cancelled", variant: "muted" },
  NO_SHOW: { label: "No show", variant: "destructive" },
} as const;

export function ReservationStatusBadge({ status }: { status: string }) {
  const s = RESERVATION_STATUS[status as keyof typeof RESERVATION_STATUS];
  return s ? <Badge variant={s.variant}>{s.label}</Badge> : <Badge variant="outline">{status}</Badge>;
}
