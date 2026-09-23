import { NextResponse } from "next/server";
import { listActivity, isActivityLoggingEnabled } from "@/lib/activity-log";
import { apiError } from "@/lib/api-error";

export async function GET() {
  try {
    const [entries, enabled] = await Promise.all([listActivity(), isActivityLoggingEnabled()]);
    return NextResponse.json({ entries, enabled });
  } catch (error) {
    return apiError(error);
  }
}
