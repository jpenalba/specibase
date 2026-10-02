import { NextResponse } from "next/server";
import { markNotificationSeen } from "@/lib/notifications-store";
import { requireUser } from "@/lib/require-user";
import { apiError } from "@/lib/api-error";

// Called right as the nav bar navigates to the shared project — dismisses
// the notification so it doesn't show again. markNotificationSeen scopes
// its update to the caller's own user_id, so this can't touch anyone
// else's notification even given an arbitrary id.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const { id } = await params;
    await markNotificationSeen(id, auth.user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
