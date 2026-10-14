import { Badge } from "@mrac/ui/components/badge";

export function RentalStatusBadge({ status, expectedReturnAt }: { status: string; expectedReturnAt: Date | string }) {
  if (status === "OPEN" && new Date(expectedReturnAt) < new Date()) return <Badge variant="destructive">Overdue</Badge>;
  if (status === "OPEN") return <Badge variant="success">Open</Badge>;
  if (status === "CLOSED") return <Badge variant="muted">Closed</Badge>;
  return <Badge variant="warning">Void</Badge>;
}
