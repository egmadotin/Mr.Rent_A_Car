import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, isStaff } from "@mrac/auth";
import { LoginForm } from "./login-form";
import { BrandLogo } from "@mrac/ui/components/brand-logo";

export const metadata = { title: "Staff Sign in · Mr Rent A Car ERP" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const session = await auth.api.getSession({ headers: await headers() });
  if (session && isStaff(session.user)) redirect(next?.startsWith("/admin") ? next : "/admin");

  return (
    <main className="grid min-h-dvh place-items-center bg-erp-watermark-pattern px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <div className="flex justify-center">
            <BrandLogo variant="light" className="h-12 w-auto object-contain drop-shadow-xs" />
          </div>
          <div className="space-y-0.5">
            <h1 className="font-serif text-xl font-bold tracking-tight text-foreground">
              Staff Portal Login
            </h1>
            <p className="text-[11px] uppercase font-bold tracking-widest text-muted-foreground font-sans">
              Fleet Operations & Management ERP
            </p>
          </div>
        </div>
        <LoginForm next={next} forbidden={error === "forbidden"} />
      </div>
    </main>
  );
}
