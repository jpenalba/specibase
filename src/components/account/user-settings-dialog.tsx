"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// Opened from the account dropdown. Password change goes through the same
// email-link flow as "Forgot password" (see /forgot-password,
// /reset-password) rather than changing it immediately in-session — the
// emailed link is what "confirmation from the original email" actually
// means here, and it reuses infrastructure that already exists instead of
// inventing a second one.
export function UserSettingsDialog({
  open,
  onOpenChange,
  email,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
}) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (next) {
      setSent(false);
      setError(null);
    }
  }

  async function handleChangePassword() {
    setSending(true);
    setError(null);
    try {
      const { error } = await getSupabaseBrowserClient().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        setError(error.message);
        return;
      }
      setSent(true);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>User settings</DialogTitle>
          <DialogDescription>Manage your Specibase account.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 rounded-md border border-border p-4">
          <div>
            <p className="font-medium">Password</p>
            <p className="text-sm text-muted-foreground">
              We&apos;ll email a reset link to {email} — changing your password requires clicking
              it to confirm it&apos;s really you.
            </p>
          </div>

          {sent && (
            <div className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
              Check {email} for a link to finish changing your password.
            </div>
          )}
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            className="w-fit"
            disabled={sending || sent}
            onClick={handleChangePassword}
          >
            {sending ? "Sending..." : sent ? "Link sent" : "Change password"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
