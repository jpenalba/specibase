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
// accounts out from under whoever's already signed in.
//
// IMPORTANT: @supabase/ssr's createBrowserClient caches a module-level
// singleton and, by default, hands that *same* instance back to every
// caller regardless of what options a later call passes — only the
// options from whichever call happens to construct it first actually
// take effect. A one-off client with non-default options (like the
// detectSessionInUrl: false peek above) must pass isSingleton: false,
// or it'll silently become the shared singleton and "lock in" its
// options for every other getSupabaseBrowserClient() call on the page.
export function getSupabaseBrowserClient(options?: {
  detectSessionInUrl?: boolean;
  isSingleton?: boolean;
}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables"
    );
  }
  return createBrowserClient(url, anonKey, {
    isSingleton: options?.isSingleton ?? true,
    auth: { detectSessionInUrl: options?.detectSessionInUrl ?? true },
  });
}
