import { getSupabase } from "./supabase";
import { findProfileByIdentifier } from "./profile-store";

// Whether `userId`'s account has actually been confirmed — i.e. someone
// clicked an invite or magic link and the account is real, not just the
// auth.users row an invite's own creation leaves sitting there unconfirmed
// until then. Supabase never clears email_confirmed_at once it's set, so
// this is a one-way flip from "pending" to "registered."
export async function isAccountConfirmed(userId: string): Promise<boolean> {
  const { data, error } = await getSupabase().auth.admin.getUserById(userId);
  if (error || !data.user) return false;
  return Boolean(data.user.email_confirmed_at);
}

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
// registered anything. This tells the two apart via email_confirmed_at
// before deciding which it really is, so an Owner can re-send as many
// times as it takes for someone to actually get around to accepting.
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

  if (await isAccountConfirmed(profile.id)) {
    return { ok: false, errors: ["This email already has a Specibase account."] };
  }

  // Still just a pending invite, never accepted — resend via the
  // password-recovery flow, which works for any existing account
  // regardless of confirmation state and lands on the exact same
  // /reset-password page an invite link does (see reset-password/page.tsx'
  // own comment on treating any fresh session the same way).
  const { error: resendError } = await getSupabase().auth.resetPasswordForEmail(email, { redirectTo });
  if (resendError) return { ok: false, errors: [resendError.message] };
  return { ok: true, userId: profile.id, resent: true };
}
