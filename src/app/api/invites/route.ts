import { NextRequest, NextResponse } from "next/server";
import { inviteOrResendEmail } from "@/lib/account-invites";
import { requireUser } from "@/lib/require-user";
import { apiError } from "@/lib/api-error";

// A bare "join Specibase" invite — the account-menu counterpart to a
// project's own "Add member" (project-members-store.ts's
// addMemberByIdentifier), minus the project_members row: this just gets
// someone an account, with no project attached. Any signed-in account can
// send one — this is a small, invite-only tool (see
// AUTH_AND_PERMISSIONS_PLAN.md), not something that needs an admin tier.
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;

    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    if (!email || !email.includes("@")) {
      return NextResponse.json({ errors: ["A valid email is required"] }, { status: 400 });
    }

    // See addMemberByIdentifier in project-members-store.ts / the comment
    // on inviteOrResendEmail for why redirectTo matters here and why this
    // isn't a plain inviteUserByEmail call — without either, re-sending to
    // someone who hasn't gotten around to accepting yet errors as if
    // they'd already registered.
    const result = await inviteOrResendEmail(email, `${new URL(request.url).origin}/reset-password`);
    if (!result.ok) {
      return NextResponse.json({ errors: result.errors }, { status: 400 });
    }
    return NextResponse.json({ ok: true, resent: result.resent }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
