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

type LinkTokens =
  | { kind: "implicit"; accessToken: string; refreshToken: string }
  | { kind: "pkce"; code: string }
  | { kind: "none" };

// Pulls this link's actual credentials out of the URL ourselves, rather
// than letting the Supabase client auto-detect them. admin.inviteUserByEmail
// and auth.resetPasswordForEmail links are verified by Supabase's hosted
// /verify redirect, which hands back a ready-to-use access_token+refresh_token
// pair in the hash fragment (the "implicit" shape) — there's no browser-side
// code_verifier for the client library to pair with a `code` param, since no
// signInWith... call ever ran in *this* browser to create one. But
// @supabase/ssr's createBrowserClient unconditionally sets flowType: "pkce"
// (see supabase-browser.ts) on every client it creates, and the client
// library refuses to auto-consume an implicit-style URL when its own
// flowType is pkce — it throws "Not a valid PKCE flow url." instead, which
// surfaces here as a silent "Link expired". Parsing the tokens ourselves and
// handing them to setSession()/exchangeCodeForSession() directly (see
// applyLinkTokens below) sidesteps that flow-type check entirely — those
// calls don't care what the client was configured with, they just take
// whatever credentials they're given.
function parseLinkTokens(): LinkTokens {
  if (typeof window === "undefined") return { kind: "none" };
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");
  if (accessToken && refreshToken) return { kind: "implicit", accessToken, refreshToken };

  const code = new URLSearchParams(window.location.search).get("code");
  if (code) return { kind: "pkce", code };

  return { kind: "none" };
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
// send a link here.
export default function ResetPasswordPage() {
  const [linkType] = useState<LinkType>(() => parseLinkType());
  const [linkEmail] = useState<string | null>(() => parseLinkEmail());
  const [linkTokens] = useState<LinkTokens>(() => parseLinkTokens());

  const [phase, setPhase] = useState<"checking" | "conflict" | "ready" | "expired">("checking");
  const [conflictEmail, setConflictEmail] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Guards every setPhase call below against firing after unmount.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Applies this link's own credentials and waits for the resulting
  // session — only called once it's established that doing so won't
  // silently replace someone else's active session (see the precheck in
  // the effect below). Uses a throwaway client (isSingleton: false):
  // setSession()/exchangeCodeForSession() write straight through to the
  // shared cookie storage regardless of which client instance calls them,
  // so nothing here depends on it being any particular "the" client.
  async function startSession() {
    let supabase;
    try {
      supabase = getSupabaseBrowserClient({ detectSessionInUrl: false, isSingleton: false });
    } catch {
      if (mountedRef.current) setPhase("expired");
      return;
    }

    const { error } =
      linkTokens.kind === "implicit"
        ? await supabase.auth.setSession({
            access_token: linkTokens.accessToken,
            refresh_token: linkTokens.refreshToken,
          })
        : linkTokens.kind === "pkce"
          ? await supabase.auth.exchangeCodeForSession(linkTokens.code)
          : { error: new Error("No credentials in URL") };

    if (!mountedRef.current) return;
    if (error) {
      setPhase("expired");
      return;
    }
    // Drop the tokens/code from the address bar now that they're applied —
    // they're single-use and no longer needed, and leaving them visible in
    // the URL bar/history is needless exposure.
    window.history.replaceState(null, "", window.location.pathname);
    setPhase("ready");
  }

  useEffect(() => {
    // A client that only checks for a session that was *already* active in
    // this browser before this link landed, so the person can be asked
    // before it gets silently replaced. Skipped (the link's session
    // applied immediately, as before) when the account signed in already
    // matches who this link is actually for — the ordinary "change my own
    // password while logged in" case from User settings, which shouldn't
    // need an extra prompt. isSingleton: false keeps this one-off instance
    // from becoming the shared client (see supabase-browser.ts).
    let precheck;
    try {
      precheck = getSupabaseBrowserClient({ detectSessionInUrl: false, isSingleton: false });
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
      await getSupabaseBrowserClient({ detectSessionInUrl: false, isSingleton: false }).auth.signOut();
    } catch {
      // Reload regardless — it re-evaluates everything from scratch either
      // way, and any lingering session just re-triggers the conflict screen.
    }
    // A full reload, not a client-side retry: the nav bar and every other
    // Server Component on the page were rendered with the now-stale signed
    // in session, and only a real navigation re-fetches them against the
    // cleared cookie. The link's own tokens/code are still sitting in the
    // URL (startSession never got to run yet on this path), so reloading
    // lands right back on the same precheck → startSession logic above,
    // this time with no conflicting session in the way.
    window.location.reload();
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
        {linkType === "invite" ? (
          // No self-service resend here on purpose — /forgot-password's
          // resetPasswordForEmail would send a Recovery-type email to an
          // account that's never set a password, which reads as broken as
          // the original "wrong email template" bug this flow was built to
          // avoid. Only whoever invited them can actually resend an Invite
          // (via project members → Invite other users), which re-sends
          // this app's own real invite email once more.
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
