"use client";

import { useCallback, useEffect, useState } from "react";
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

// The account dropdown in the nav bar's top right — a Profile section
// (summary + an edit entry point) first, other account-level actions
// (just Sign out for now) below. More sections land here as later auth
// phases add things like the personal activity-log toggle.
export function AccountMenu({ user }: { user: CurrentUser }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

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

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <span className="max-w-[12rem] truncate">{name}</span>
            <ChevronDown className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <div className="px-2 py-1.5">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Profile
            </p>
            <p className="truncate text-sm font-medium">{name}</p>
            {name !== user.email && (
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            )}
            {profile?.institution && (
              <p className="truncate text-xs text-muted-foreground">{profile.institution}</p>
            )}
          </div>
          <DropdownMenuItem onSelect={() => setDialogOpen(true)}>Edit profile</DropdownMenuItem>
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
    </>
  );
}
