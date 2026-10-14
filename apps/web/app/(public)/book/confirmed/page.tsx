import Link from "next/link";
import { CheckCircle2Icon } from "lucide-react";
import { Button } from "@mrac/ui/components/button";
import { money } from "@mrac/ui/lib/format";
import { BookingSteps } from "../steps";

export const metadata = { title: "Reservation requested", robots: { index: false } };

export default async function ConfirmedPage({ searchParams }: { searchParams: Promise<{ n?: string; total?: string }> }) {
  const { n, total } = await searchParams;
  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-10">
      <BookingSteps current={4} />
      <div className="space-y-4 rounded-xl border bg-card p-8 text-center">
        <CheckCircle2Icon className="mx-auto size-12 text-success" />
        <h1 className="text-2xl font-bold">Reservation requested</h1>
        {n && <p className="text-lg">Your reservation number is <span className="font-mono font-bold">#{n}</span>.</p>}
        {total && <p className="text-muted-foreground">Estimated total {money(total)}, payable at pick-up.</p>}
        <p className="text-muted-foreground">We’ll contact you shortly to confirm. Please bring your driver’s licence and a credit card.</p>
        <Button asChild><Link href="/">Back to home</Link></Button>
      </div>
    </div>
  );
}
