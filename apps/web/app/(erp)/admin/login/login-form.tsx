"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { authClient } from "@mrac/auth/client";
import { Button } from "@mrac/ui/components/button";
import { Card, CardContent } from "@mrac/ui/components/card";
import { Input } from "@mrac/ui/components/input";
import { Label } from "@mrac/ui/components/label";

export function LoginForm({ next, forbidden }: { next?: string; forbidden?: boolean }) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(forbidden ? "This account doesn't have ERP access." : null);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    const { error } = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    setPending(false);
    if (error) return setError(error.message ?? "Sign-in failed.");
    router.replace(next?.startsWith("/admin") ? next : "/admin");
    router.refresh();
  }

  return (
    <Card className="gap-0 overflow-hidden rounded-xl border border-[#D5D5D5] bg-white/95 p-0 text-[#2D2C2C] shadow-2xl backdrop-blur-xs">
      <div className="h-1 w-full bg-primary" />
      <CardContent className="p-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-[#575656]">
              Email Address
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              autoFocus
              className="h-10 border-[#D5D5D5] bg-white text-[#2D2C2C] shadow-2xs focus-visible:border-primary focus-visible:ring-primary/30"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-[#575656]">
              Password
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="h-10 border-[#D5D5D5] bg-white text-[#2D2C2C] shadow-2xs focus-visible:border-primary focus-visible:ring-primary/30"
            />
          </div>
          {error && (
            <p role="alert" className="text-xs font-semibold text-destructive">
              {error}
            </p>
          )}
          <Button
            type="submit"
            className="h-10 w-full bg-primary font-bold text-white shadow-xs transition-colors hover:bg-terra-80"
            disabled={pending}
          >
            {pending && <Loader2Icon className="animate-spin" />}
            Sign in
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
