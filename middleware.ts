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
const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password"];
// API routes reachable while signed out — just the one the login form
// itself needs (turning a username into an email before it can even call
// Supabase Auth). Checked separately from PUBLIC_PATHS since, unlike
// /login, an already-signed-in caller hitting this shouldn't get bounced
// to "/" — it's a plain lookup, not a page.
const PUBLIC_API_PATHS = ["/api/auth/resolve-identifier"];
// Reachable both signed out AND signed in, unlike PUBLIC_PATHS — this is
// where a password-reset email's link lands. That link carries a fresh
// "recovery" session the browser only establishes client-side once the
// page's own JS runs (see reset-password/page.tsx), so the very first,
// server-rendered load of this page still looks signed-out to this
// middleware and must not be redirected to /login. It also has to stay
// reachable for someone with an *ordinary* signed-in session already in
// that browser — the "change password" flow in User settings sends this
// same link while already logged in, and PUBLIC_PATHS' bounce-to-"/"
// behavior would break that case.
const PUBLIC_NO_BOUNCE_PATHS = ["/reset-password"];

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
  const isNoBouncePublicPath = PUBLIC_NO_BOUNCE_PATHS.includes(request.nextUrl.pathname);

  if (!user && !isPublicPath && !isPublicApiPath && !isNoBouncePublicPath) {
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

// Excludes static files served straight out of /public (the Specibase
// logo, the focal-group category icons under /logos) along with Next's own
// _next/static, _next/image, and favicon.ico — none of these are pages or
// API routes, so gating them behind auth only ever breaks a signed-out
// visitor's first look at the app (the login page's own logo, caught via
// exactly this: it loaded in a browser that had it cached from an earlier
// signed-in visit, but 404'd into a login-page redirect in a browser that
// didn't, since an <img> tag can't render an HTML redirect response as an
// image). Matches by file extension rather than listing every path,
// everything under /public that this app actually serves is an image.
export const config = {
  matcher: "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)",
};
