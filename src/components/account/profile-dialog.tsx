"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PROFILE_TITLES, Profile, ProfileTitle } from "@/lib/profile-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle as DialogTitleHeading,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

type FormState = {
  title: ProfileTitle | "";
  lastName: string;
  firstName: string;
  institution: string;
  position: string;
  labGroup: string;
};

function formFromProfile(profile: Profile | null): FormState {
  return {
    title: profile?.title ?? "",
    lastName: profile?.last_name ?? "",
    firstName: profile?.first_name ?? "",
    institution: profile?.institution ?? "",
    position: profile?.position ?? "",
    labGroup: profile?.lab_group ?? "",
  };
}

// Opened from the account dropdown's Profile section — edits the signed-in
// account's own profile only (there's no target-user picker; the route
// this posts to always acts on whoever's session it is).
export function ProfileDialog({
  profile,
  open,
  onOpenChange,
  onSaved,
}: {
  profile: Profile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<FormState>(() => formFromProfile(profile));
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (next) {
      setValues(formFromProfile(profile));
      setErrors([]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrors([]);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: values.title || null,
          last_name: values.lastName,
          first_name: values.firstName,
          institution: values.institution,
          position: values.position,
          lab_group: values.labGroup,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors(data.errors ?? ["Couldn't save your profile."]);
        return;
      }
      onOpenChange(false);
      onSaved();
      // The nav bar's displayed name comes from a Server Component prop —
      // this re-runs it so the new name shows up immediately.
      router.refresh();
    } catch {
      setErrors(["Couldn't reach the server."]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitleHeading>Edit profile</DialogTitleHeading>
          <DialogDescription>
            This is just about you — it&apos;s not shared with anyone automatically.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          {errors.length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <ul className="list-disc pl-4">
                {errors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-[7rem_1fr] gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="profile-title">Title</Label>
              <select
                id="profile-title"
                value={values.title}
                onChange={(e) => update("title", e.target.value as ProfileTitle | "")}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">None</option>
                {PROFILE_TITLES.map((title) => (
                  <option key={title} value={title}>
                    {title}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="profile-first-name">First name</Label>
              <Input
                id="profile-first-name"
                value={values.firstName}
                onChange={(e) => update("firstName", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="profile-last-name">Last name</Label>
            <Input
              id="profile-last-name"
              value={values.lastName}
              onChange={(e) => update("lastName", e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="profile-institution">Institution</Label>
            <Input
              id="profile-institution"
              value={values.institution}
              onChange={(e) => update("institution", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="profile-position">Position</Label>
              <Input
                id="profile-position"
                value={values.position}
                onChange={(e) => update("position", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="profile-lab-group">Lab group</Label>
              <Input
                id="profile-lab-group"
                value={values.labGroup}
                onChange={(e) => update("labGroup", e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
