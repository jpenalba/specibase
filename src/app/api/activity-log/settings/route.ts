import { NextRequest, NextResponse } from "next/server";
import { isActivityLoggingEnabled, setActivityLoggingEnabled } from "@/lib/activity-log";
import { apiError } from "@/lib/api-error";

export async function GET() {
  try {
    const enabled = await isActivityLoggingEnabled();
    return NextResponse.json({ enabled });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    if (typeof body?.enabled !== "boolean") {
      return NextResponse.json({ errors: ["'enabled' must be a boolean"] }, { status: 400 });
    }
    await setActivityLoggingEnabled(body.enabled);
    return NextResponse.json({ enabled: body.enabled });
  } catch (error) {
    return apiError(error);
  }
}
