import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, isStaff } from "@mrac/auth";
import { LoginForm } from "./login-form";
import { BrandLogo } from "@mrac/ui/components/brand-logo";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const session = await auth.api.getSession({ headers: await headers() });
  if (session && isStaff(session.user)) redirect(next?.startsWith("/admin") ? next : "/admin");

  return (
    <main className="grid min-h-dvh place-items-center bg-muted/40 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="mb-2 flex justify-center">
            <BrandLogo className="h-14" />
          </h1>
          <p className="text-sm text-muted-foreground">Staff sign-in</p>
        </div>
        <LoginForm next={next} forbidden={error === "forbidden"} />
      </div>
    </main>
  );
}
