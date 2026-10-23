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
    <div className="mx-auto w-full max-w-md px-4 py-12">
      <div className="rounded-2xl border bg-card p-6 shadow-sm md:p-8">
        <h1 className="text-2xl font-bold">{title}</h1>
        {intro && <p className="mt-1 text-sm text-muted-foreground">{intro}</p>}
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

const Alert = ({ children }: { children: React.ReactNode }) => <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{children}</p>;

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
    <AccountCard title="Log In" intro="Log in to fill in your details when you book and to see your bookings.">
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <F id="email" label="Email" type="email" auto="email" />
        <F id="password" label="Password" type="password" auto="current-password" />
        <div className="flex justify-end text-sm"><Link href="/account/forgot" className="text-primary hover:underline">Forgot password?</Link></div>
        <Button type="submit" className="w-full" size="lg" disabled={pending}>{pending && <Loader2Icon className="animate-spin" />}Log In</Button>
        <p className="text-center text-sm text-muted-foreground">
          New here? <Link href={`/account/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-primary hover:underline">Create an account</Link>
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
          <p className="flex items-start gap-2"><CheckCircle2Icon className="mt-0.5 size-5 shrink-0 text-forest-100" /> You&apos;re logged in.</p>
          {done.emailed
            ? <p className="flex items-start gap-2"><MailIcon className="mt-0.5 size-5 shrink-0 text-primary" /> We sent you an email: confirm your address to see your earlier bookings in your account.</p>
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
        <p className="text-center text-sm text-muted-foreground">Already have an account? <Link href="/account/login" className="font-medium text-primary hover:underline">Log in</Link></p>
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
        <p className="flex items-start gap-2 text-sm"><MailIcon className="mt-0.5 size-5 shrink-0 text-primary" /> If there&apos;s an account with that email, a reset link is on its way. It works for 1 hour.</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error && <Alert>{error}</Alert>}
          <F id="email" label="Email" type="email" auto="email" err={err("email")} />
          <Button type="submit" className="w-full" disabled={pending}>{pending && <Loader2Icon className="animate-spin" />}Send reset link</Button>
          <p className="text-center text-sm"><Link href="/account/login" className="text-primary hover:underline">Back to log in</Link></p>
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
          <p className="flex items-start gap-2"><CheckCircle2Icon className="mt-0.5 size-5 shrink-0 text-forest-100" /> Your password is changed.</p>
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
            <p className="flex items-start gap-2"><CheckCircle2Icon className="mt-0.5 size-5 shrink-0 text-forest-100" /> Your email is confirmed. Your bookings with us now show in your account.</p>
            <Button asChild className="w-full"><Link href="/account">My account</Link></Button>
          </div>
        ) : <Alert>{state}</Alert>}
    </AccountCard>
  );
}

const day = (d: Date | string, tz: string) => new Date(d).toLocaleString("en-CA", { timeZone: tz, dateStyle: "medium", timeStyle: "short" });
const RES_STATUS: Record<string, string> = { TENTATIVE: "Requested", CONFIRMED: "Confirmed", CHECKED_OUT: "Picked up", CHECKED_IN: "Returned", CANCELLED: "Cancelled", NO_SHOW: "No show" };

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

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">My Account</h1>
          <p className="text-muted-foreground">{u.name} · {u.email}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild><Link href="/book">Book a car</Link></Button>
          <Button variant="outline" onClick={async () => { await authClient.signOut(); await qc.invalidateQueries(); router.push("/"); router.refresh(); }}><LogOutIcon /> Log out</Button>
        </div>
      </div>

      {!u.emailVerified && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <span>Confirm your email to see bookings you made before (we sent you a link).</span>
          <Button size="sm" variant="outline" onClick={() => client.account.resendVerification.mutate().then(() => setResent("Sent — check your inbox."), (e: Error) => setResent(e.message))}>Resend email</Button>
          {resent && <span className="w-full">{resent}</span>}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Reservations</h2>
        {!b?.reservations.length ? <p className="rounded-md bg-muted p-4 text-sm text-muted-foreground">No reservations yet.</p> : (
          <ul className="divide-y rounded-lg border bg-card">
            {b.reservations.map((r) => (
              <li key={r.number} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                <div>
                  <p className="font-semibold">#{r.number} · {r.vehicleType.name}</p>
                  <p className="text-muted-foreground">{day(r.pickupAt, r.pickupLocation.timeZone)} → {day(r.returnAt, r.pickupLocation.timeZone)}</p>
                  <p className="text-muted-foreground">{r.pickupLocation.name}{r.returnLocation.name !== r.pickupLocation.name ? ` → ${r.returnLocation.name}` : ""}</p>
                </div>
                <div className="text-right">
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold">{RES_STATUS[r.status] ?? r.status}</span>
                  <p className="mt-1 font-semibold tabular-nums">{r.total.toLocaleString("en-CA", { style: "currency", currency: "CAD" })}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Rentals</h2>
        {!b?.rentals.length ? <p className="rounded-md bg-muted p-4 text-sm text-muted-foreground">No rentals yet.</p> : (
          <ul className="divide-y rounded-lg border bg-card">
            {b.rentals.map((r) => (
              <li key={r.raNumber} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                <div>
                  <p className="font-semibold">Rental #{r.raNumber} · {r.vehicleType.name}</p>
                  <p className="text-muted-foreground">{day(r.checkOutAt, r.checkOutLocation.timeZone)} → {day(r.checkedInAt ?? r.expectedReturnAt, r.checkOutLocation.timeZone)}</p>
                </div>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold">{r.status === "OPEN" ? "On rent" : "Returned"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
