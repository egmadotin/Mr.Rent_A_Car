import { UnsubscribeButton } from "./unsubscribe-button";

export const metadata = { title: "Unsubscribe", robots: { index: false } };

/** From the link at the foot of a marketing email. Asks for a click so link scanners don't unsubscribe anyone. */
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ c?: string; t?: string }> }) {
  const { c, t } = await searchParams;
  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-16 text-center">
      <h1 className="text-3xl font-extrabold tracking-tight">Unsubscribe</h1>
      {c && t ? (
        <>
          <p className="text-muted-foreground">Stop receiving offers and news from Mr Rent A Car by email? You will still get emails about your own bookings.</p>
          <UnsubscribeButton c={c} t={t} />
        </>
      ) : (
        <p className="text-muted-foreground">This unsubscribe link is incomplete. Please use the link from the email.</p>
      )}
    </div>
  );
}
