import { createBrowserClient } from "@supabase/ssr";

// Session-aware Supabase client for Client Components — the /login form's
// sign-in call, and sign-out from the nav bar. Uses the public anon key,
// never the service-role key (which must stay server-only, see
// ./supabase). The anon key only grants what RLS allows, which today is
// nothing on every table — this client is for identity only, never for
// reading or writing application data.
//
// `detectSessionInUrl` defaults to true (the library's own default) —
// pass false to get a client that won't auto-consume an auth link's
// tokens from the URL. /reset-password uses this to peek at whatever
// session already exists in this browser *before* an invite/recovery
// link's tokens get applied, so it can ask before silently switching
// accounts out from under whoever's already signed in. Safe to call this
// repeatedly with different options — each call makes its own client
// instance, but they all read/write the same underlying session cookies.
export function getSupabaseBrowserClient(options?: { detectSessionInUrl?: boolean }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables"
    );
  }
  return createBrowserClient(url, anonKey, {
    auth: { detectSessionInUrl: options?.detectSessionInUrl ?? true },
  });
}
