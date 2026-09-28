"use client";

import { useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Reachable signed out (see middleware.ts's PUBLIC_PATHS). Always shows
// the same "check your email" outcome whether or not the address has an
// account — same enumeration-safety reasoning as
// /api/auth/resolve-identifier, just without needing a route of its own
// since resetPasswordForEmail is a plain client-side Supabase Auth call.
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await getSupabaseBrowserClient().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
    } catch {
      // Fall through to the same "check your email" message regardless —
      // nothing here should tell a caller whether the address exists.
    } finally {
      setSubmitting(false);
      setSent(true);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Reset your password</h1>
        <p className="text-sm text-muted-foreground">
          Enter your account&apos;s email and we&apos;ll send you a link to set a new password.
        </p>
      </div>

      {sent ? (
        <div className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
          If that email has a Specibase account, a reset link is on its way. Check your inbox (and
          spam folder) and follow the link to set a new password.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={submitting || !email.trim()}>
            {submitting ? "Sending..." : "Send reset link"}
          </Button>
        </form>
      )}

      <Link href="/login" className="text-xs text-muted-foreground hover:underline">
        Back to sign in
      </Link>
    </div>
  );
}
