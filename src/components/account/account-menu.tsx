"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { CurrentUser } from "@/lib/current-user";
import { Profile, formatDisplayName } from "@/lib/profile-store";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ProfileDialog } from "./profile-dialog";
import { InviteUserDialog } from "./invite-user-dialog";
import { UserSettingsDialog } from "./user-settings-dialog";
import { Avatar } from "./avatar";

// The account dropdown in the nav bar's top right — a Profile section
// (summary + an edit entry point) first, then other account-level actions
// (inviting someone else to Specibase, user settings, sign out) below.
export function AccountMenu({ user }: { user: CurrentUser }) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const load = useCallback(() => {
    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => setProfile(data.profile ?? null))
      .catch(() => {
        // The dropdown still works (falls back to email) if this fails.
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function signOut() {
    await getSupabaseBrowserClient().auth.signOut();
    // A full navigation — proxy.ts needs to see the cleared session
    // cookie, which a client-side route transition wouldn't re-fetch for.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
  }

  const name = (profile ? formatDisplayName(profile) : null) ?? user.displayName ?? user.email;
  const avatarUrl = profile?.avatar_url ?? user.avatarUrl;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md px-1.5 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <Avatar url={avatarUrl} size={26} />
            <span className="max-w-[10rem] truncate">{name}</span>
            <ChevronDown className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <div className="flex items-center gap-3 px-2 py-1.5">
            <Avatar url={avatarUrl} size={36} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Profile
              </p>
              <p className="truncate text-sm font-medium">{name}</p>
              {name !== user.email && (
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              )}
            </div>
          </div>
          {profile?.institution && (
            <p className="truncate px-2 pb-1.5 text-xs text-muted-foreground">
              {profile.institution}
              {profile.department ? ` · ${profile.department}` : ""}
            </p>
          )}
          <DropdownMenuItem onSelect={() => setDialogOpen(true)}>Edit profile</DropdownMenuItem>
          <div className="my-1 h-px bg-border" />
          <DropdownMenuItem onSelect={() => router.push("/collaborators")}>Collaborators</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setInviteOpen(true)}>Invite other users</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>User settings</DropdownMenuItem>
          <div className="my-1 h-px bg-border" />
          <DropdownMenuItem variant="destructive" onSelect={signOut}>
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ProfileDialog
        profile={profile}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={load}
      />
      <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      <UserSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} email={user.email} />
    </>
  );
}
