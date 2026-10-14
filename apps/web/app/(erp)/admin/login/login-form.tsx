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
    <Card>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="username" required autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending && <Loader2Icon className="animate-spin" />}
            Sign in
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
