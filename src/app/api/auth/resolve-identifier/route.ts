import { NextRequest, NextResponse } from "next/server";
import { getEmailForUsername } from "@/lib/profile-store";
import { apiError } from "@/lib/api-error";

// Deliberately reachable while signed out (see middleware.ts's PUBLIC_PATHS)
// — the login form calls this to turn a username into the email Supabase
// Auth actually signs in with, since it only ever takes an email. Never
// requires a session and never reveals whether a username exists: a miss
// gets the exact same generic error the login form would show for a wrong
// password, so this can't be used to enumerate accounts.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const identifier = typeof body?.identifier === "string" ? body.identifier.trim() : "";
    if (!identifier) {
      return NextResponse.json({ errors: ["Invalid username or password"] }, { status: 401 });
    }
    const email = await getEmailForUsername(identifier);
    if (!email) {
      return NextResponse.json({ errors: ["Invalid username or password"] }, { status: 401 });
    }
    return NextResponse.json({ email });
  } catch (error) {
    return apiError(error);
  }
}
