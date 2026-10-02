import { NextResponse } from "next/server";
import { listUnseenNotifications } from "@/lib/notifications-store";
import { requireUser } from "@/lib/require-user";
import { apiError } from "@/lib/api-error";

// Polled by the nav bar's AccountMenu to drive its notification bell —
// see account-menu.tsx. Only ever the caller's own unseen notifications.
export async function GET() {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const notifications = await listUnseenNotifications(auth.user.id);
    return NextResponse.json({ notifications });
  } catch (error) {
    return apiError(error);
  }
}
