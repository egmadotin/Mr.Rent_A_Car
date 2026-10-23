"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2Icon, Loader2Icon, LogOutIcon, MailIcon } from "lucide-react";
import { useTRPC, useTRPCClient } from "@mrac/api/client";
import { authClient } from "@mrac/auth/client";
import { Button } from "@mrac/ui/components/button";
import { Input } from "@mrac/ui/components/input";
import { Label } from "@mrac/ui/components/label";

type Errors = Record<string, string[] | undefined>;

/** Only same-site paths are followed after login (no open redirects). */
export const safeNext = (next?: string | null) => (next && next.startsWith("/") && !next.startsWith("//") ? next : "/account");

export function AccountCard({ title, intro, children }: { title: string; intro?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-14">
      <div className="rounded-sheet border bg-card p-6 md:p-9">
        <h1 className="type-title-2">{title}</h1>
        {intro && <p className="mt-2 text-[15px] text-muted-foreground">{intro}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

function F({ id, label, type = "text", auto, err }: { id: string; label: string; type?: string; auto?: string; err?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} type={type} autoComplete={auto} required aria-invalid={!!err} />
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}

const Alert = ({ children }: { children: React.ReactNode }) => <p role="alert" className="rounded-control bg-blush px-4 py-3 text-sm font-semibold text-brand">{children}</p>;

function useSubmit<T>(fn: (f: FormData) => Promise<T>) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<Errors>({});
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    setErrors({});
    try {
      await fn(new FormData(e.currentTarget));
    } catch (err) {
      const fe = (err as { data?: { zodError?: { fieldErrors?: Errors } } })?.data?.zodError?.fieldErrors ?? {};
      setErrors(fe);
      setError(Object.keys(fe).length ? "Please check the highlighted fields." : (err as Error).message);
    } finally {
      setPending(false);
    }
  };
  return { pending, error, err: (k: string) => errors[k]?.[0], onSubmit };
}

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { pending, error, onSubmit } = useSubmit(async (f) => {
    const { error: e } = await authClient.signIn.email({ email: String(f.get("email") ?? "").trim(), password: String(f.get("password") ?? "") });
    if (e) throw new Error(e.status === 401 ? "Wrong email or password." : (e.message ?? "Could not log in."));
    await qc.invalidateQueries();
    router.push(safeNext(next));
    router.refresh();
  });
  return (
    <AccountCard title="Log in" intro="Log in to fill in your details when you book and to see your bookings.">
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <F id="email" label="Email" type="email" auto="email" />
        <F id="password" label="Password" type="password" auto="current-password" />
        <div className="flex justify-end text-sm"><Link href="/account/forgot" className="font-semibold underline underline-offset-2 hover:text-brand">Forgot password?</Link></div>
        <Button type="submit" className="w-full" size="lg" disabled={pending}>{pending && <Loader2Icon className="animate-spin" />}Log in</Button>
        <p className="text-center text-sm text-muted-foreground">
          New here? <Link href={`/account/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold underline underline-offset-2 hover:text-brand">Create an account</Link>
        </p>
      </form>
    </AccountCard>
  );
}

export function SignUpForm({ next }: { next?: string }) {
  const client = useTRPCClient();
  const router = useRouter();
  const qc = useQueryClient();
  const [done, setDone] = React.useState<{ emailed: boolean } | null>(null);
  const { pending, error, err, onSubmit } = useSubmit(async (f) => {
    const g = (k: string) => String(f.get(k) ?? "");
    if (g("password") !== g("confirm")) throw new Error("The two passwords don't match.");
    const r = await client.account.signUp.mutate({ firstName: g("firstName"), lastName: g("lastName"), email: g("email"), password: g("password"), website: g("website") || undefined });
    await authClient.signIn.email({ email: g("email").trim(), password: g("password") });
    await qc.invalidateQueries();
    router.refresh();
    setDone(r);
  });
  if (done)
    return (
      <AccountCard title="Account created">
        <div className="space-y-4 text-sm">
          <p className="flex items-start gap-2"><CheckCircle2Icon className="mt-0.5 size-5 shrink-0 text-success" /> You&apos;re logged in.</p>
          {done.emailed
            ? <p className="flex items-start gap-2"><MailIcon className="mt-0.5 size-5 shrink-0 text-steel" /> We sent you an email: confirm your address to see your earlier bookings in your account.</p>
            : <p className="text-muted-foreground">We couldn&apos;t send the confirmation email right now; you can resend it from your account later.</p>}
          <Button className="w-full" onClick={() => router.push(safeNext(next))}>Continue</Button>
        </div>
      </AccountCard>
    );
  return (
    <AccountCard title="Create an account" intro="Book faster: your details are filled in for you.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <F id="firstName" label="First Name" auto="given-name" err={err("firstName")} />
          <F id="lastName" label="Last Name" auto="family-name" err={err("lastName")} />
        </div>
        <F id="email" label="Email" type="email" auto="email" err={err("email")} />
        <F id="password" label="Password (at least 8 characters)" type="password" auto="new-password" err={err("password")} />
        <F id="confirm" label="Confirm Password" type="password" auto="new-password" />
        <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
        <Button type="submit" className="w-full" size="lg" disabled={pending}>{pending && <Loader2Icon className="animate-spin" />}Create account</Button>
        <p className="text-center text-sm text-muted-foreground">Already have an account? <Link href="/account/login" className="font-semibold underline underline-offset-2 hover:text-brand">Log in</Link></p>
      </form>
    </AccountCard>
  );
}

export function ForgotForm() {
  const client = useTRPCClient();
  const [sent, setSent] = React.useState(false);
  const { pending, error, err, onSubmit } = useSubmit(async (f) => {
    await client.account.requestPasswordReset.mutate({ email: String(f.get("email") ?? "") });
    setSent(true);
  });
  return (
    <AccountCard title="Forgot password" intro="Enter your email and we'll send you a link to choose a new password.">
      {sent ? (
        <p className="flex items-start gap-2 text-sm"><MailIcon className="mt-0.5 size-5 shrink-0 text-steel" /> If there&apos;s an account with that email, a reset link is on its way. It works for 1 hour.</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error && <Alert>{error}</Alert>}
          <F id="email" label="Email" type="email" auto="email" err={err("email")} />
          <Button type="submit" className="w-full" disabled={pending}>{pending && <Loader2Icon className="animate-spin" />}Send reset link</Button>
          <p className="text-center text-sm"><Link href="/account/login" className="font-semibold underline underline-offset-2 hover:text-brand">Back to log in</Link></p>
        </form>
      )}
    </AccountCard>
  );
}

export function ResetForm({ token }: { token: string }) {
  const client = useTRPCClient();
  const [done, setDone] = React.useState(false);
  const { pending, error, err, onSubmit } = useSubmit(async (f) => {
    const p = String(f.get("password") ?? "");
    if (p !== String(f.get("confirm") ?? "")) throw new Error("The two passwords don't match.");
    await client.account.resetPassword.mutate({ token, password: p });
    setDone(true);
  });
  return (
    <AccountCard title="Choose a new password">
      {done ? (
        <div className="space-y-4 text-sm">
          <p className="flex items-start gap-2"><CheckCircle2Icon className="mt-0.5 size-5 shrink-0 text-success" /> Your password is changed.</p>
          <Button asChild className="w-full"><Link href="/account/login">Log in</Link></Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error && <Alert>{error}</Alert>}
          <F id="password" label="New password (at least 8 characters)" type="password" auto="new-password" err={err("password")} />
          <F id="confirm" label="Confirm new password" type="password" auto="new-password" />
          <Button type="submit" className="w-full" disabled={pending || !token}>{pending && <Loader2Icon className="animate-spin" />}Save password</Button>
        </form>
      )}
    </AccountCard>
  );
}

export function VerifyEmail({ token }: { token: string }) {
  const client = useTRPCClient();
  const qc = useQueryClient();
  const [state, setState] = React.useState<"working" | "ok" | string>("working");
  const ran = React.useRef(false);
  React.useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    client.account.verifyEmail.mutate({ token }).then(
      () => { setState("ok"); void qc.invalidateQueries(); },
      (e: Error) => setState(e.message),
    );
  }, [client, qc, token]);
  return (
    <AccountCard title="Confirm your email">
      {state === "working" ? <p className="flex items-center gap-2 text-sm"><Loader2Icon className="size-4 animate-spin" /> Confirming…</p>
        : state === "ok" ? (
          <div className="space-y-4 text-sm">
            <p className="flex items-start gap-2"><CheckCircle2Icon className="mt-0.5 size-5 shrink-0 text-success" /> Your email is confirmed. Your bookings with us now show in your account.</p>
            <Button asChild className="w-full"><Link href="/account">My account</Link></Button>
          </div>
        ) : <Alert>{state}</Alert>}
    </AccountCard>
  );
}

const day = (d: Date | string, tz: string) => new Date(d).toLocaleString("en-CA", { timeZone: tz, dateStyle: "medium", timeStyle: "short" });
const cad = (n: number) => n.toLocaleString("en-CA", { style: "currency", currency: "CAD" });
/** Customer-facing booking statuses (badge text + colour). */
export const STATUS: Record<string, { label: string; className: string }> = {
  TENTATIVE: { label: "Requested", className: "bg-amber-tint text-amber-ds" },
  CONFIRMED: { label: "Confirmed", className: "bg-steel-tint text-steel" },
  CHECKED_OUT: { label: "Picked up", className: "bg-green-tint text-racing" },
  CHECKED_IN: { label: "Completed", className: "bg-muted text-foreground" },
  CANCELLED: { label: "Cancelled", className: "bg-blush text-brand" },
  NO_SHOW: { label: "No show", className: "bg-blush text-brand" },
  OPEN: { label: "On rent", className: "bg-green-tint text-racing" },
  CLOSED: { label: "Completed", className: "bg-muted text-foreground" },
  VOIDED: { label: "Voided", className: "bg-blush text-brand" },
};
export const StatusBadge = ({ status }: { status: string }) => (
  <span className={`rounded-pill px-2.5 py-0.5 text-xs font-semibold ${STATUS[status]?.className ?? "bg-muted"}`}>{STATUS[status]?.label ?? status}</span>
);

type Row = { key: string; href: string; title: string; status: string; when: string; where: string; total: number; paid: number; balance: number; at: Date; upcoming: boolean };

export function MyAccount() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const router = useRouter();
  const qc = useQueryClient();
  const me = useQuery(trpc.account.me.queryOptions());
  const bookings = useQuery({ ...trpc.account.bookings.queryOptions(), enabled: !!me.data });
  const [resent, setResent] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (me.isFetched && !me.data) router.replace("/account/login?next=/account");
  }, [me.isFetched, me.data, router]);
  if (!me.data) return <div className="py-24 text-center text-sm text-muted-foreground"><Loader2Icon className="mx-auto size-5 animate-spin" /></div>;
  const u = me.data;
  const b = bookings.data;
  const now = Date.now();
  // one history: reservations not yet turned into a rental, and every rental (its reservation is shown on it)
  const rows: Row[] = [
    ...(b?.reservations ?? []).filter((r) => !r.rental).map((r) => ({
      key: `res${r.number}`, href: `/account/bookings/reservation/${r.number}`, title: `Reservation #${r.number} · ${r.vehicleType.name}`, status: r.status,
      when: `${day(r.pickupAt, r.pickupLocation.timeZone)} → ${day(r.returnAt, r.pickupLocation.timeZone)}`,
      where: r.pickupLocation.name + (r.returnLocation.name !== r.pickupLocation.name ? ` → ${r.returnLocation.name}` : ""),
      total: r.total, paid: r.paid, balance: r.balance, at: new Date(r.pickupAt), upcoming: ["TENTATIVE", "CONFIRMED"].includes(r.status) && +new Date(r.returnAt) > now,
    })),
    ...(b?.rentals ?? []).map((r) => ({
      key: `ra${r.raNumber}`, href: `/account/bookings/rental/${r.raNumber}`,
      title: `Rental #${r.raNumber} · ${r.vehicle ? `${r.vehicle.year ?? ""} ${r.vehicle.make.name} ${r.vehicle.model.name}`.trim() : r.vehicleType.name}`, status: r.status,
      when: `${day(r.checkOutAt, r.checkOutLocation.timeZone)} → ${day(r.checkedInAt ?? r.expectedReturnAt, r.checkOutLocation.timeZone)}`,
      where: r.checkOutLocation.name + (r.checkInLocation.name !== r.checkOutLocation.name ? ` → ${r.checkInLocation.name}` : ""),
      total: r.total, paid: r.paid, balance: r.balance, at: new Date(r.checkOutAt), upcoming: r.status === "OPEN",
    })),
  ].sort((x, y) => +y.at - +x.at);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-10 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="type-title-1">My account</h1>
          <p className="text-muted-foreground">{u.name} · {u.email}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild><Link href="/book">Book a car</Link></Button>
          <Button variant="outline" onClick={async () => { await authClient.signOut(); await qc.invalidateQueries(); router.push("/"); router.refresh(); }}><LogOutIcon /> Log out</Button>
        </div>
      </div>

      {!u.emailVerified && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-amber-tint p-4 text-sm text-foreground">
          <span>Confirm your email to see bookings you made before (we sent you a link).</span>
          <Button size="sm" variant="outline" onClick={() => client.account.resendVerification.mutate().then(() => setResent("Sent — check your inbox."), (e: Error) => setResent(e.message))}>Resend email</Button>
          {resent && <span className="w-full">{resent}</span>}
        </div>
      )}

      <BookingHistory rows={rows} loading={bookings.isLoading} />
    </div>
  );
}

/** My Account booking history: Upcoming & current / Past / All, each opening its details. */
function BookingHistory({ rows, loading }: { rows: Row[]; loading: boolean }) {
  const [tab, setTab] = React.useState<"current" | "past" | "all">("current");
  const shown = rows.filter((r) => (tab === "all" ? true : tab === "current" ? r.upcoming : !r.upcoming));
  const tabs = [
    { key: "current" as const, label: "Upcoming & current", n: rows.filter((r) => r.upcoming).length },
    { key: "past" as const, label: "Past", n: rows.filter((r) => !r.upcoming).length },
    { key: "all" as const, label: "All", n: rows.length },
  ];
  const owing = rows.reduce((a, r) => a + Math.max(0, r.balance), 0);
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="type-title-3">My bookings</h2>
        <div className="flex gap-1 rounded-pill bg-muted p-1" role="tablist">
          {tabs.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
              className={`rounded-pill px-3.5 py-1.5 text-sm font-semibold ${tab === t.key ? "bg-card shadow-primary" : "text-muted-foreground hover:text-foreground"}`}>
              {t.label} <span className="tabular-nums text-muted-foreground">{t.n}</span>
            </button>
          ))}
        </div>
      </div>
      {owing > 0.005 && <p className="rounded-control bg-amber-tint px-4 py-3 text-sm text-foreground">Balance owing on your bookings: <span className="font-semibold">{cad(owing)}</span></p>}
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : !shown.length ? (
        <p className="rounded-card bg-muted p-5 text-sm text-muted-foreground">{tab === "current" ? "No upcoming bookings." : "No bookings here yet."} <Link href="/book" className="font-semibold underline underline-offset-2 hover:text-brand">Book a car</Link></p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-card border bg-card">
          {shown.map((r) => (
            <li key={r.key}>
              <Link href={r.href} className="flex flex-wrap items-center justify-between gap-3 p-5 text-sm transition-colors hover:bg-muted/50">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">{r.title} <StatusBadge status={r.status} /></p>
                  <p className="text-muted-foreground">{r.when}</p>
                  <p className="text-muted-foreground">{r.where}</p>
                </div>
                <div className="text-right tabular-nums">
                  <p className="font-semibold">{cad(r.total)}</p>
                  {r.paid > 0 && <p className="text-xs text-muted-foreground">Paid {cad(r.paid)}</p>}
                  {r.balance > 0.005 && <p className="text-xs font-semibold text-amber-ds">Balance {cad(r.balance)}</p>}
                  <p className="mt-1 text-xs font-semibold">Details →</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** One booking in full (reservation or rental): status, dates, branches, vehicle, charges, payments and balance. */
export function BookingDetail({ kind, number }: { kind: "reservation" | "rental"; number: number }) {
  const trpc = useTRPC();
  const router = useRouter();
  const me = useQuery(trpc.account.me.queryOptions());
  const q = useQuery({ ...trpc.account.booking.queryOptions({ kind, number }), enabled: !!me.data, retry: false });
  React.useEffect(() => {
    if (me.isFetched && !me.data) router.replace(`/account/login?next=/account/bookings/${kind}/${number}`);
  }, [me.isFetched, me.data, router, kind, number]);
  if (q.error) return <AccountCard title="Booking not found"><p className="text-sm text-muted-foreground">{q.error.message}</p><Button asChild className="mt-4"><Link href="/account">My Account</Link></Button></AccountCard>;
  const d = q.data;
  if (!d) return <div className="py-24 text-center"><Loader2Icon className="mx-auto size-5 animate-spin text-muted-foreground" /></div>;
  const tz = d.kind === "rental" ? d.checkOutLocation.timeZone : d.pickupLocation.timeZone;
  const out = d.kind === "rental" ? d.checkOutLocation : d.pickupLocation;
  const back = d.kind === "rental" ? d.checkInLocation : d.returnLocation;
  const steps = d.kind === "rental"
    ? [{ label: "Picked up", at: d.checkOutAt, done: true }, { label: d.status === "OPEN" ? "Due back" : "Returned", at: d.checkedInAt ?? d.expectedReturnAt, done: d.status === "CLOSED" }]
    : [{ label: "Booked", at: d.createdAt, done: true }, { label: "Pick-up", at: d.pickupAt, done: ["CHECKED_OUT", "CHECKED_IN"].includes(d.status) }, { label: "Return", at: d.returnAt, done: d.status === "CHECKED_IN" }];
  const places: [string, typeof out][] = [["Pick-up", out], ["Return", back]];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10 sm:px-8">
      <Link href="/account" className="text-sm font-semibold text-muted-foreground hover:text-foreground">← My account</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="type-title-2">{d.kind === "rental" ? `Rental #${d.raNumber}` : `Reservation #${d.number}`}</h1>
        <StatusBadge status={d.status} />
      </div>
      {d.kind === "reservation" && d.rental && <p className="text-sm">This reservation was picked up as <Link href={`/account/bookings/rental/${d.rental.raNumber}`} className="font-semibold underline underline-offset-2 hover:text-brand">Rental #{d.rental.raNumber}</Link>.</p>}
      {d.kind === "rental" && d.reservation && <p className="text-sm text-muted-foreground">From reservation #{d.reservation.number}.</p>}
      {d.kind === "reservation" && d.status === "TENTATIVE" && <p className="rounded-control bg-amber-tint px-4 py-3 text-sm text-foreground">We have received your request and will confirm it shortly.</p>}

      <ol className="grid gap-3 sm:grid-cols-3">
        {steps.map((st) => (
          <li key={st.label} className={`rounded-card border p-4 text-sm ${st.done ? "border-transparent bg-green-tint" : "bg-card"}`}>
            <p className="flex items-center gap-1.5 font-semibold">{st.done && <CheckCircle2Icon className="size-4 text-racing" />}{st.label}</p>
            <p className="text-muted-foreground">{day(st.at, tz)}</p>
          </li>
        ))}
      </ol>

      <div className="grid gap-4 sm:grid-cols-2">
        {places.map(([label, x]) => (
          <div key={label} className="rounded-card border bg-card p-5 text-sm">
            <p className="text-xs font-semibold text-muted-foreground">{label}</p>
            <p className="font-semibold">{x.name}</p>
            <p className="text-muted-foreground">{[x.address1, x.city].filter(Boolean).join(", ")}</p>
            {x.phone && <a href={`tel:${x.phone}`} className="font-semibold underline underline-offset-2 hover:text-brand">{x.phone}</a>}
          </div>
        ))}
      </div>

      <div className="rounded-card border bg-card p-5 text-sm">
        <p className="text-xs font-semibold text-muted-foreground">Vehicle</p>
        <p className="font-semibold">{d.kind === "rental" && d.vehicle ? `${d.vehicle.year ?? ""} ${d.vehicle.make.name} ${d.vehicle.model.name}`.trim() : d.vehicleType.name}</p>
        <p className="text-muted-foreground">{d.vehicleType.name}{d.kind === "rental" && d.vehicle?.licenseNumber ? ` · Plate ${d.vehicle.licenseNumber}` : ""}</p>
        {d.kind === "rental" && <p className="text-muted-foreground">Km out {d.odometerOut.toLocaleString()}{d.odometerIn != null ? ` · in ${d.odometerIn.toLocaleString()} (${(d.odometerIn - d.odometerOut).toLocaleString()} km)` : ""}</p>}
      </div>

      <div className="overflow-hidden rounded-card border bg-card">
        <p className="border-b px-4 py-3 text-sm font-semibold">Charges</p>
        <table className="w-full text-sm">
          <tbody className="divide-y">
            {d.lines.map((l, i) => (
              <tr key={i} className={l.tax ? "text-muted-foreground" : undefined}>
                <td className="px-4 py-2">{l.name}{!l.tax && l.units !== 1 && l.units !== 0 ? <span className="text-muted-foreground"> · {l.units} × {cad(l.rate)}</span> : ""}</td>
                <td className="px-4 py-2 text-right tabular-nums">{cad(l.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t font-semibold">
            <tr><td className="px-4 py-2">Total</td><td className="px-4 py-2 text-right tabular-nums">{cad(d.total)}</td></tr>
            {d.payments.map((p, i) => (
              <tr key={i} className="font-normal text-muted-foreground">
                <td className="px-4 py-1.5">{p.refund ? "Refund" : "Payment"} · {p.method}{p.last4 ? ` ••${p.last4}` : ""} · {new Date(p.at).toLocaleDateString("en-CA", { timeZone: tz, dateStyle: "medium" })}</td>
                <td className="px-4 py-1.5 text-right tabular-nums">{p.refund ? "" : "−"}{cad(p.amount)}</td>
              </tr>
            ))}
            <tr className={d.balance > 0.005 ? "text-amber-ds" : undefined}><td className="px-4 py-2">Balance</td><td className="px-4 py-2 text-right tabular-nums">{cad(d.balance)}</td></tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Questions about this booking? Call {out.phone ?? "us"} and quote {d.kind === "rental" ? `rental #${d.raNumber}` : `reservation #${d.number}`}.</p>
    </div>
  );
}
