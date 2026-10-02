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
//
// The resend itself deletes the stale, unconfirmed auth.users row and
// invites again from scratch, rather than reusing the password-recovery
// flow (an earlier version of this did that, but it sends Supabase's
// "Reset Password" email template, which reads oddly to someone who's
// never had an account). There's nothing worth keeping on that row — no
// password, no completed profile — and deleting it makes the email look
// "new" to Supabase again, so it sends its real Invite template instead.
// profiles cascades on auth.users delete, and any project_members row
// from the original invite cascades with it; addMemberByIdentifier
// re-creates that row under the new user id right after this returns, so
// nothing is actually lost.
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

  const { error: deleteError } = await getSupabase().auth.admin.deleteUser(profile.id);
  if (deleteError) return { ok: false, errors: [deleteError.message] };

  const retry = await getSupabase().auth.admin.inviteUserByEmail(email, { redirectTo });
  if (retry.error || !retry.data.user) {
    return { ok: false, errors: [retry.error?.message ?? "Couldn't resend the invite"] };
  }
  return { ok: true, userId: retry.data.user.id, resent: true };
}
