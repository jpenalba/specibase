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
export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

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
    setSubmitting(true);
    setError(null);
    try {
      const { data, error } = await getSupabaseBrowserClient().auth.signUp({
        email: email.trim(),
        password,
        // Only reached if the Supabase project requires confirming the
        // email before signing in — /reset-password already handles "a
        // Supabase link just dropped me here with a fresh session"
        // generically (see its own comment), so confirming here reuses it
        // rather than needing a dedicated page of its own.
        options: { emailRedirectTo: `${window.location.origin}/reset-password` },
      });
      if (error) {
        setError(error.message);
        return;
      }
      if (data.session) {
        // Email confirmation isn't required on this project — signUp
        // already returned a usable session, so there's nothing left to
        // wait on. Mark the account registered the same way
        // /reset-password does, so a later "Add member" invite to this
        // same email correctly sees it as already taken rather than
        // offering to resend one.
        await fetch("/api/profile/registered", { method: "POST" }).catch(() => {});
        // A full navigation, not router.push — proxy.ts and every Server
        // Component need to see the session cookie signUp just set.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/";
        return;
      }
      setCheckEmail(true);
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

      {checkEmail ? (
        <div className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
          Almost there — check {email} for a confirmation link to finish setting up your account.
        </div>
      ) : (
        <>
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
        </>
      )}

      <Link href="/login" className="text-xs text-muted-foreground hover:underline">
        Already have an account? Sign in
      </Link>
    </div>
  );
}
