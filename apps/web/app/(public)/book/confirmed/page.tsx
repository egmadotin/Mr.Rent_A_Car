import Link from "next/link";
import { CheckIcon } from "lucide-react";
import { Button } from "@mrac/ui/components/button";
import { money } from "@mrac/ui/lib/format";
import { BookingSteps } from "../steps";

export const metadata = { title: "Reservation requested", robots: { index: false } };

export default async function ConfirmedPage({ searchParams }: { searchParams: Promise<{ n?: string; total?: string }> }) {
  const { n, total } = await searchParams;
  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 px-4 py-10">
      <BookingSteps current={4} />
      <div className="space-y-5 rounded-sheet border bg-card p-8 text-center sm:p-12">
        <span className="mx-auto grid size-14 place-items-center rounded-pill bg-green-tint text-racing">
          <CheckIcon className="size-7" strokeWidth={2.5} />
        </span>
        <h1 className="type-title-2">Reservation requested</h1>
        {n && (
          <p className="text-[17px]">
            Your confirmation number <span className="type-code ml-1 rounded-[6px] bg-muted px-2 py-1 text-sm text-foreground">#{n}</span>
          </p>
        )}
        {total && <p className="text-muted-foreground">Estimated total <span className="font-semibold text-foreground tabular-nums">{money(total)}</span>, payable at pick-up.</p>}
        <p className="mx-auto max-w-md text-muted-foreground">We’ll contact you shortly to confirm. Please bring your driver’s licence and a credit card.</p>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Button asChild variant="ink" size="lg"><Link href="/account">My account</Link></Button>
          <Button asChild variant="outline" size="lg"><Link href="/">Back to home</Link></Button>
        </div>
      </div>
    </div>
  );
}
