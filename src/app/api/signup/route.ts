import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { apiError } from "@/lib/api-error";

// Creates the account directly via the admin API with email_confirm:
// true, bypassing whatever this Supabase project's own "Confirm email"
// setting is — self-service sign-up (/signup) shouldn't depend on an
// email link working, since an unreliable link is the exact problem this
// whole stopgap exists to route around. This route only creates the row;
// signup/page.tsx signs the new account in itself right after, with the
// same credentials.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    if (!email || !email.includes("@")) {
      return NextResponse.json({ errors: ["A valid email is required"] }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ errors: ["Password must be at least 8 characters"] }, { status: 400 });
    }

    const { error } = await getSupabase().auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) {
      return NextResponse.json({ errors: [error.message] }, { status: 400 });
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
