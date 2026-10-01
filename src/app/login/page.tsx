"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function LoginForm() {
  const searchParams = useSearchParams();
  // Only ever a same-origin path — proxy.ts is the only thing that sets
  // this param, but a crafted link could put anything here, so this
  // guards against being used as an open redirect off-site.
  const rawNext = searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const trimmed = identifier.trim();
      let email = trimmed;
      // Supabase Auth only ever signs in with an email — a bare username
      // needs resolving first. "@" is enough to tell them apart, since
      // usernames are deliberately restricted to a non-email character set
      // (see USERNAME_PATTERN in profile-store.ts).
      if (!trimmed.includes("@")) {
        const res = await fetch("/api/auth/resolve-identifier", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: trimmed }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.errors?.join(" ") ?? "Invalid username or password");
          return;
        }
        email = data.email;
      }

      const { error } = await getSupabaseBrowserClient().auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
        return;
      }
      // A full navigation, not router.push — proxy.ts and every Server
      // Component need to see the session cookie the sign-in call just
      // set, which a client-side route transition wouldn't re-fetch for.
      window.location.href = next;
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="text-sm text-muted-foreground">Sign in to Specibase with your account.</p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="identifier">Email or username</Label>
          <Input
            id="identifier"
            type="text"
            autoComplete="username"
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs text-muted-foreground hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <p className="text-xs text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="underline">
          Create one
        </Link>
        .
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
