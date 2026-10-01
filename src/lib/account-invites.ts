import { getSupabase } from "./supabase";
import { findProfileByIdentifier } from "./profile-store";

export type InviteResult =
  | { ok: true; userId: string; resent: boolean }
  | { ok: false; errors: string[] };

// Sends a "join Specibase" invite — or, if this exact email was already
// invited but never finished signing up, resends one instead of bubbling
// up Supabase's "A user with this email address has already been
// registered" error. inviteUserByEmail creates the auth.users row
// (unconfirmed) the moment an invite goes out, so a second invite to the
// same still-pending address looks identical to "this person already has
// an account" from that error alone, even though they've never actually
// registered anything.
//
// Telling the two apart uses this app's own profiles.registered_at, not
// Supabase's email_confirmed_at — that flips true the moment someone
// merely *clicks* an invite or recovery link, before they've necessarily
// set a password (verification happens as part of following the link,
// server-side, ahead of whatever the destination page does). Someone who
// clicked an invite and abandoned it before finishing — or hit this app's
// own now-fixed broken-redirect bug — would otherwise look "confirmed"
// and get wrongly blocked from ever being re-invited. registered_at only
// gets set once a password has actually been saved (see
// POST /api/profile/registered, called from /reset-password).
export async function inviteOrResendEmail(email: string, redirectTo: string): Promise<InviteResult> {
  const { data, error } = await getSupabase().auth.admin.inviteUserByEmail(email, { redirectTo });
  if (!error) {
    if (!data.user) return { ok: false, errors: ["Couldn't send the invite"] };
    return { ok: true, userId: data.user.id, resent: false };
  }

  const alreadyRegistered =
    error.code === "email_exists" || /already.*registered/i.test(error.message);
  if (!alreadyRegistered) return { ok: false, errors: [error.message] };

  const profile = await findProfileByIdentifier(email);
  if (!profile) return { ok: false, errors: [error.message] };

  if (profile.registered_at) {
    return { ok: false, errors: ["This email already has a Specibase account."] };
  }

  // Still just a pending invite, never actually registered — resend via
  // the password-recovery flow, which works for any existing account
  // regardless of confirmation state and lands on the exact same
  // /reset-password page an invite link does.
  const { error: resendError } = await getSupabase().auth.resetPasswordForEmail(email, { redirectTo });
  if (resendError) return { ok: false, errors: [resendError.message] };
  return { ok: true, userId: profile.id, resent: true };
}
