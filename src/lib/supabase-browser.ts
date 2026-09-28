import { createBrowserClient } from "@supabase/ssr";

// Session-aware Supabase client for Client Components — the /login form's
// sign-in call, and sign-out from the nav bar. Uses the public anon key,
// never the service-role key (which must stay server-only, see
// ./supabase). The anon key only grants what RLS allows, which today is
// nothing on every table — this client is for identity only, never for
// reading or writing application data.
export function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables"
    );
  }
  return createBrowserClient(url, anonKey);
}
