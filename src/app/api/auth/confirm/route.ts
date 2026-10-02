import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { apiError } from "@/lib/api-error";

const VALID_TYPES = ["invite", "recovery"] as const;
type ConfirmType = (typeof VALID_TYPES)[number];

function isConfirmType(value: unknown): value is ConfirmType {
  return typeof value === "string" && (VALID_TYPES as readonly string[]).includes(value);
}

// The actual token-consuming step behind /auth/confirm — deliberately a
// POST a person has to trigger by clicking a button, not something that
// runs the moment the link's page loads. Supabase's email links are
// single-use, and an email client's link-prefetch/security-scanner (which
// only ever issues an inert GET against whatever URL sits in the email
// body) will burn through a single-use token before the recipient ever
// gets to click it, if the link itself is what performs the verification.
// That's what was actually causing this app's invite/recovery links to
// come back "otp_expired" immediately — see the comment on
// src/app/auth/confirm/page.tsx. Splitting verification out into its own
// POST sidesteps it: a prefetch only ever loads the inert confirm page.
//
// Also guards against silently clobbering an already-signed-in session:
// verifyOtp() below would otherwise just overwrite whoever's cookie is
// already there. If someone's signed in and didn't pass force, this
// reports the conflict and returns before the token is touched at all, so
// the link is still good if they come back after signing out.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const tokenHash = typeof body?.token_hash === "string" ? body.token_hash : null;
    const type = body?.type;
    const force = body?.force === true;

    if (!tokenHash || !isConfirmType(type)) {
      return NextResponse.json({ errors: ["Invalid or missing link parameters"] }, { status: 400 });
    }

    const supabase = await getSupabaseServerClient();

    const {
      data: { user: existing },
    } = await supabase.auth.getUser();

    if (existing) {
      if (!force) {
        return NextResponse.json(
          { conflict: true, existingEmail: existing.email },
          { status: 409 }
        );
      }
      await supabase.auth.signOut();
    }

    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) {
      return NextResponse.json({ errors: [error.message] }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
