import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, isStaff } from "@mrac/auth";
import { BrandLogo } from "@mrac/ui/components/brand-logo";
import { LoginForm } from "./login-form";

export const metadata = { title: "Staff sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const session = await auth.api.getSession({ headers: await headers() });
  if (session && isStaff(session.user)) redirect(next?.startsWith("/admin") ? next : "/admin");

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute -top-48 -right-40 size-[40rem] rounded-full bg-[radial-gradient(circle,var(--brand-glow)_0%,transparent_62%)] opacity-50" />
      <div className="relative w-full max-w-[400px] space-y-8">
        <div className="space-y-3 text-center">
          <BrandLogo className="text-[28px]" />
          <div>
            <h1 className="text-[22px] font-bold tracking-tight">Staff sign in</h1>
            <p className="mt-1 text-sm text-muted-foreground">Reservations, rentals and fleet — one place.</p>
          </div>
        </div>
        <LoginForm next={next} forbidden={error === "forbidden"} />
        <p className="text-center text-xs text-muted-foreground">Trouble signing in? Ask an administrator to check your user in Settings › Users.</p>
      </div>
    </main>
  );
}
