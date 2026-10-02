"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type LinkType = "invite" | "recovery";

type Phase = "button" | "working" | "conflict" | "error" | "invalid";

// Where every invite and password-reset email link actually lands —
// Supabase's email templates point here with ?token_hash=...&type=...
// (see AUTH_AND_PERMISSIONS_PLAN.md and the Invite/Reset Password
// templates in the Supabase dashboard), rather than at Supabase's own
// hosted /auth/v1/verify endpoint via the default {{ .ConfirmationURL }}.
//
// The verification itself doesn't happen on page load — it's gated behind
// a button the person has to click, which calls /api/auth/confirm. This
// is the actual fix for links coming back "otp_expired" immediately after
// being sent: email clients and corporate security gateways commonly
// prefetch every link in an email's body to scan it, which is an inert
// GET for this page but would silently burn through Supabase's
// single-use token if *that* GET were also what verified it (as it is
// when the token is consumed directly by Supabase's own /verify
// redirect). Requiring a real click means only an actual person — not a
// scanner that never interacts with the page afterward — ever reaches the
// POST that consumes the token. See
// https://github.com/orgs/supabase/discussions/28193.
function ConfirmForm() {
  const searchParams = useSearchParams();
  const tokenHash = searchParams.get("token_hash");
  const linkType: LinkType = searchParams.get("type") === "invite" ? "invite" : "recovery";

  const [phase, setPhase] = useState<Phase>(tokenHash ? "button" : "invalid");
  const [conflictEmail, setConflictEmail] = useState<string | null>(null);

  async function confirm(force: boolean) {
    setPhase("working");
    try {
      const res = await fetch("/api/auth/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token_hash: tokenHash, type: linkType, force }),
      });
      if (res.status === 409) {
        const data = await res.json();
        setConflictEmail(data.existingEmail ?? null);
        setPhase("conflict");
        return;
      }
      if (!res.ok) {
        setPhase("error");
        return;
      }
      // A full navigation — the session /api/auth/confirm just established
      // lives in a cookie, and every Server Component downstream needs to
      // see it, which a client-side route transition wouldn't re-fetch for.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = `/reset-password?type=${linkType}`;
    } catch {
      setPhase("error");
    }
  }

  if (phase === "invalid" || phase === "error") {
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

  if (phase === "conflict") {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold">You&apos;re already signed in</h1>
          <p className="text-sm text-muted-foreground">
            This browser is currently signed in as <strong>{conflictEmail}</strong>. To continue
            with this {linkType === "invite" ? "invite" : "password reset link"}, you&apos;ll need
            to sign out of that account first.
          </p>
        </div>
        <Button onClick={() => confirm(true)}>Sign out and continue</Button>
        <Link href="/" className="text-xs text-muted-foreground hover:underline">
          Stay signed in as {conflictEmail}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {linkType === "invite" ? "Join Specibase" : "Reset your password"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {linkType === "invite"
            ? "You've been invited to Specibase. Continue to create your account."
            : "Continue to choose a new password."}
        </p>
      </div>
      <Button onClick={() => confirm(false)} disabled={phase === "working"}>
        {phase === "working" ? "Please wait..." : "Continue"}
      </Button>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense>
      <ConfirmForm />
    </Suspense>
  );
}
