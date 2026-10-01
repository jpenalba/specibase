import { NextResponse } from "next/server";
import { markRegistered } from "@/lib/profile-store";
import { requireUser } from "@/lib/require-user";
import { apiError } from "@/lib/api-error";

// Called from /reset-password right after updateUser() succeeds — the
// recovery/invite session that page runs under is already readable here
// via the usual cookie-based session (requireUser), since @supabase/ssr's
// browser and server clients share the same cookie storage. Marks the
// caller's own account as actually registered (see profile-store.ts's
// registered_at), which is what lets account-invites.ts tell a merely-
// clicked, still-passwordless invite apart from a real account.
export async function POST() {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    await markRegistered(auth.user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
