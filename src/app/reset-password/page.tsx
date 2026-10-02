"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LinkType = "invite" | "recovery";

// Supabase appends `type=invite` or `type=recovery` to this page's URL
// alongside the session tokens — as a hash fragment (#...&type=invite) in
// the implicit flow, or a query param (?code=...&type=invite) under PKCE.
// Checked in both places since this app doesn't control which flow a given
// Supabase project uses. Unknown/missing type falls back to "recovery",
// matching this page's original (pre-invite) behavior.
function parseLinkType(): LinkType {
  if (typeof window === "undefined") return "recovery";
  const fromHash = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("type");
  const fromQuery = new URLSearchParams(window.location.search).get("type");
  return (fromHash ?? fromQuery) === "invite" ? "invite" : "recovery";
}

function base64UrlDecode(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return atob(padded);
}

// Best-effort, display-only — reads the target account's email straight
// out of the access_token JWT already sitting in the URL (implicit flow
// only; PKCE's opaque `code` can't be read this way), without calling
// Supabase or establishing any session. Used only to tell "this link is
// for the account already signed in on this browser" (safe to proceed
// without asking) apart from "this link is for someone else" (see the
// sign-out prompt below) — never for anything security-sensitive, since
// nothing here is signature-verified.
function parseLinkEmail(): string | null {
  if (typeof window === "undefined") return null;
  const token = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("access_token");
  if (!token) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(token.split(".")[1]));
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

// Where a password-reset or invite email's link lands — reachable signed
// out AND signed in (see middleware.ts's PUBLIC_NO_BOUNCE_PATHS), since
// "forgot password", an invite, and User settings' "change password" all
// send a link here. The link itself carries a short-lived session that the
// Supabase browser client picks up from the URL as soon as a client with
// detectSessionInUrl enabled is created — that's what actually authorizes
// the updateUser() call below, not whatever session (if any) was already
// in this browser.
export default function ResetPasswordPage() {
  const [linkType] = useState<LinkType>(() => parseLinkType());
  const [linkEmail] = useState<string | null>(() => parseLinkEmail());

  const [phase, setPhase] = useState<"checking" | "conflict" | "ready" | "expired">("checking");
  const [conflictEmail, setConflictEmail] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Guards every setPhase call below against firing after unmount — shared
  // across the initial effect and handleSignOutAndContinue's own re-run of
  // the same session-establishing logic, so neither path needs its own
  // bespoke cancellation handling.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Applies this link's tokens and waits for the resulting session — only
  // called once it's established that doing so won't silently replace
  // someone else's active session (see the precheck in the effect below,
  // and handleSignOutAndContinue which calls this again once that
  // conflicting session is out of the way).
  function startSession() {
    let supabase;
    try {
      supabase = getSupabaseBrowserClient();
    } catch {
      Promise.resolve().then(() => {
        if (mountedRef.current) setPhase("expired");
      });
      return;
    }
    supabase.auth.onAuthStateChange((event, session) => {
      if (!mountedRef.current) return;
      if (event === "PASSWORD_RECOVERY" || session) setPhase("ready");
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mountedRef.current) return;
      if (session) setPhase("ready");
      else setPhase((prev) => (prev === "checking" ? "expired" : prev));
    });
  }

  useEffect(() => {
    // A client that deliberately doesn't auto-consume this link's tokens
    // yet — just long enough to see whether *another* session was already
    // active in this browser before this link landed, so the person can be
    // asked before it gets silently replaced. Skipped (the link's session
    // applied immediately, as before) when the account signed in already
    // matches who this link is actually for — the ordinary "change my own
    // password while logged in" case from User settings, which shouldn't
    // need an extra prompt.
    let precheck;
    try {
      precheck = getSupabaseBrowserClient({ detectSessionInUrl: false });
    } catch {
      Promise.resolve().then(() => {
        if (mountedRef.current) setPhase("expired");
      });
      return;
    }
    precheck.auth.getSession().then(({ data: { session: existing } }) => {
      if (!mountedRef.current) return;
      const existingEmail = existing?.user.email ?? null;
      if (existingEmail && existingEmail !== linkEmail) {
        setConflictEmail(existingEmail);
        setPhase("conflict");
        return;
      }
      startSession();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSignOutAndContinue() {
    setSigningOut(true);
    try {
      await getSupabaseBrowserClient({ detectSessionInUrl: false }).auth.signOut();
    } catch {
      // Proceed regardless — establishing the new session below is what
      // actually matters, and it'll succeed or fail on its own.
    }
    setConflictEmail(null);
    setPhase("checking");
    setSigningOut(false);
    startSession();
  }

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

  if (phase === "conflict") {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold">You&apos;re already signed in</h1>
          <p className="text-sm text-muted-foreground">
            This browser is currently signed in as <strong>{conflictEmail}</strong>.{" "}
            {linkType === "invite"
              ? "To create this new account, you'll"
              : "To continue, you'll"}{" "}
            need to sign out of that one first.
          </p>
        </div>
        <Button onClick={handleSignOutAndContinue} disabled={signingOut}>
          {signingOut ? "Signing out..." : "Sign out and continue"}
        </Button>
        <Link href="/" className="text-xs text-muted-foreground hover:underline">
          Stay signed in as {conflictEmail}
        </Link>
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
        <Button asChild>
          <Link href="/forgot-password">Send a new link</Link>
        </Button>
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
