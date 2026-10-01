"use client";

import { useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Open self-service sign-up — anyone with this URL can create their own
// account. A temporary stand-in for invite-only (see
// AUTH_AND_PERMISSIONS_PLAN.md and the login page's own note) while
// Supabase's invite emails aren't reliably reaching people; revisit
// turning this back off once that's sorted out.
//
// Skips email confirmation entirely — POST /api/signup creates the
// account via the admin API with email_confirm: true, bypassing whatever
// this Supabase project's own "Confirm email" setting is, since an
// unreliable confirmation link is the exact problem this stopgap exists
// to route around. This does mean nothing here proves the person actually
// owns the address they typed; revisit alongside fixing email delivery
// for real.
export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    const trimmedEmail = email.trim();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.errors?.join(" ") ?? "Couldn't create that account.");
        return;
      }

      // The account exists and is already confirmed — sign straight in
      // with the same credentials rather than waiting on anything else.
      const { error: signInError } = await getSupabaseBrowserClient().auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (signInError) {
        setError(`Account created, but couldn't sign you in automatically: ${signInError.message}`);
        return;
      }

      // Best-effort, same as /reset-password's own call — see
      // profile-store.ts's registered_at.
      await fetch("/api/profile/registered", { method: "POST" }).catch(() => {});

      // A full navigation, not router.push — proxy.ts and every Server
      // Component need to see the session cookie signInWithPassword just set.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/";
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Create an account</h1>
        <p className="text-sm text-muted-foreground">Set up your own Specibase account.</p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="signup-email">Email</Label>
          <Input
            id="signup-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="signup-password">Password</Label>
          <Input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="signup-confirm">Confirm password</Label>
          <Input
            id="signup-confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <Link href="/login" className="text-xs text-muted-foreground hover:underline">
        Already have an account? Sign in
      </Link>
    </div>
  );
}
