"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LinkType = "invite" | "recovery";

// Where someone lands after /auth/confirm has already verified their
// invite/recovery link and established the resulting session (as a real
// cookie — see supabase-server.ts). All this page does is confirm that
// session actually exists and let them set a password; the "is this link
// actually valid," "is it single-use and about to be burned," and "does
// this collide with a session already active in this browser" questions
// are all settled before anyone gets here — see auth/confirm/page.tsx.
//
// Still reachable directly (no ?type, no session) if someone bookmarks or
// revisits this URL — "expired" is the right thing to show in that case,
// same as a link that's genuinely used up.
function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const linkType: LinkType = searchParams.get("type") === "invite" ? "invite" : "recovery";

  const [phase, setPhase] = useState<"checking" | "ready" | "expired">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    try {
      getSupabaseBrowserClient()
        .auth.getSession()
        .then(({ data: { session } }) => {
          if (!cancelled) setPhase(session ? "ready" : "expired");
        });
    } catch {
      Promise.resolve().then(() => {
        if (!cancelled) setPhase("expired");
      });
    }
    return () => {
      cancelled = true;
    };
  }, []);

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
      const { error } = await getSupabaseBrowserClient().auth.updateUser({ password });
      if (error) {
        setError(error.message);
        return;
      }
      if (linkType === "invite") {
        // Best-effort, same as any other completed sign-up — see
        // profile-store.ts's registered_at.
        await fetch("/api/profile/registered", { method: "POST" }).catch(() => {});
      }
      // A full navigation, not router.push — proxy.ts and every Server
      // Component need to see the session the recovery flow just
      // finalized, which a client-side route transition wouldn't re-fetch
      // for (same reasoning as /login's own post-sign-in navigation).
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/";
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  if (phase === "checking") {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (phase === "expired") {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold">Link expired</h1>
          <p className="text-sm text-muted-foreground">
            This {linkType === "invite" ? "invite" : "password reset"} link is invalid or has
            expired — links only work once and for a limited time.
          </p>
        </div>
        {linkType === "invite" ? (
          <p className="text-sm text-muted-foreground">
            Ask whoever invited you to Specibase to send the invite again.
          </p>
        ) : (
          <Button asChild>
            <Link href="/forgot-password">Send a new link</Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {linkType === "invite" ? "Create your account" : "Set a new password"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {linkType === "invite"
            ? "Choose a password to finish setting up your Specibase account."
            : "Choose a new password for your account."}
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="new-password">{linkType === "invite" ? "Password" : "New password"}</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="confirm-password">Confirm password</Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting
            ? linkType === "invite"
              ? "Creating account..."
              : "Saving..."
            : linkType === "invite"
              ? "Create account"
              : "Set new password"}
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
