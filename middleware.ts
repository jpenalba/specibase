import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Real per-user auth (Phase 1 of AUTH_AND_PERMISSIONS_PLAN.md) — refreshes
// the Supabase session cookie on every request and keeps every page
// behind /login. This supersedes the APP_PASSWORD stopgap this file used
// to be (see git history): that comment always said it was "until real
// per-user auth exists," and this is that.
//
// Named/exported as `middleware`, not the newer `proxy` convention Next 16
// renamed this file to — tested against this exact Next 16.3.5 + Turbopack
// setup and `proxy.ts`/`export function proxy` is silently never invoked
// (the middleware-manifest.json this build produces stays empty). `next
// build` still recognizes `middleware.ts` under the same underlying file
// convention, so this stays on that name until Turbopack support for the
// rename is confirmed working here — re-test before renaming again.
//
// Also confirmed: `next dev` (Turbopack) registers this file in its own
// middleware-manifest.json but never actually invokes it — every request
// falls straight through with no redirect, even a trivial always-redirect
// version. `next build && next start` runs it correctly (verified: `/`
// redirects to `/login`, `/login` itself loads, unauthenticated `/api/*`
// gets a 401). So login gating only takes effect in a production build —
// `npm run dev` will not enforce it locally until this Turbopack dev-mode
// gap is fixed upstream. Re-test in dev before relying on this note.
//
// Mirrors APP_PASSWORD's own fail-open behavior for a smooth rollout: if
// the NEXT_PUBLIC_SUPABASE_* env vars aren't set yet, every request is let
// through unauthenticated (today's actual behavior) rather than the whole
// site breaking the moment this code ships, before the one-time manual
// Supabase setup (see .env.example) is done.
const PUBLIC_PATHS = ["/login"];
// API routes reachable while signed out — just the one the login form
// itself needs (turning a username into an email before it can even call
// Supabase Auth). Checked separately from PUBLIC_PATHS since, unlike
// /login, an already-signed-in caller hitting this shouldn't get bounced
// to "/" — it's a plain lookup, not a page.
const PUBLIC_API_PATHS = ["/api/auth/resolve-identifier"];

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.includes(request.nextUrl.pathname);
  const isPublicApiPath = PUBLIC_API_PATHS.includes(request.nextUrl.pathname);

  if (!user && !isPublicPath && !isPublicApiPath) {
    if (request.nextUrl.pathname.startsWith("/api")) {
      return NextResponse.json({ errors: ["Not authenticated"] }, { status: 401 });
    }
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isPublicPath) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
