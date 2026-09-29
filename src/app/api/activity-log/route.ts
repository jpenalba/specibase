import { NextResponse } from "next/server";
import { listActivityForUser } from "@/lib/activity-log";
import { requireUser } from "@/lib/require-user";
import { apiError } from "@/lib/api-error";

// The caller's own cross-project activity — see AUTH_AND_PERMISSIONS_PLAN.md
// phase 4. `enabled` here is the caller's own personal logging toggle, not
// an app-wide one; the Logs page uses it to show/hide the "logging is off"
// banner and to drive its own toggle checkbox (via PATCH /api/profile).
export async function GET() {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const entries = await listActivityForUser(auth.user.id);
    return NextResponse.json({ entries, enabled: auth.user.logEnabled });
  } catch (error) {
    return apiError(error);
  }
}
