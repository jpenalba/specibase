import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
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

    const { error } = await getSupabase().auth.admin.inviteUserByEmail(email);
    if (error) {
      return NextResponse.json({ errors: [error.message] }, { status: 400 });
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
