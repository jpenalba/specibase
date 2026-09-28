import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// Session-aware Supabase client for Server Components, Route Handlers, and
// Server Actions — reads/writes the auth cookie via next/headers. This is
// a separate client from getSupabase() in ./supabase, which uses the
// service-role key and never touches cookies; nothing here bypasses RLS,
// and this must never be used to read or write application data (that
// still goes through the service-role client exclusively) — it exists
// only to know who's signed in.
export async function getSupabaseServerClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables"
    );
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component render, which can't set
          // cookies — safe to ignore since proxy.ts refreshes the
          // session cookie on every request anyway.
        }
      },
    },
  });
}
