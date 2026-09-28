"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PROFILE_TITLES, Profile, ProfileTitle } from "@/lib/profile-store";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/image-types";
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
import { Avatar } from "./avatar";

type FormState = {
  username: string;
  title: ProfileTitle | "";
  lastName: string;
  firstName: string;
  institution: string;
  department: string;
  position: string;
  labGroup: string;
};

function formFromProfile(profile: Profile | null): FormState {
  return {
    username: profile?.username ?? "",
    title: profile?.title ?? "",
    lastName: profile?.last_name ?? "",
    firstName: profile?.first_name ?? "",
    institution: profile?.institution ?? "",
    department: profile?.department ?? "",
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState<FormState>(() => formFromProfile(profile));
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url ?? null);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Re-fills the form from `profile` right as the dialog opens — not just
  // on first mount. This dialog has no DialogTrigger of its own (it's
  // opened by the account dropdown flipping `open` from outside), and
  // Radix's Dialog only calls onOpenChange for interactions it intercepts
  // itself (Escape, overlay click, its own close button) — never for an
  // externally-controlled `open` prop change. Without this effect, the
  // form's initial (often still-loading, so empty) snapshot of `profile`
  // would stick around forever after the first open. Gated on the
  // false→true edge specifically, via prevOpenRef, so a profile refresh
  // that happens *while* already open (e.g. right after a photo upload)
  // doesn't stomp on whatever the person is mid-typing.
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setValues(formFromProfile(profile));
      setAvatarUrl(profile?.avatar_url ?? null);
      setErrors([]);
    }
    prevOpenRef.current = open;
  }, [open, profile]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  // Uploaded immediately on selection, separately from the rest of the
  // form's Save button — same reasoning as a protocol's PDF: there's
  // nothing to stage, the file itself is the whole submission.
  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setErrors([`Unsupported image type "${file.type || "unknown"}"`]);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setErrors([`Image is too large — max ${Math.floor(MAX_IMAGE_BYTES / (1024 * 1024))}MB`]);
      return;
    }

    setUploadingPhoto(true);
    setErrors([]);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/profile/avatar", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setErrors(data.errors ?? ["Couldn't upload that photo."]);
        return;
      }
      setAvatarUrl(data.profile.avatar_url);
      onSaved();
      router.refresh();
    } catch {
      setErrors(["Couldn't reach the server."]);
    } finally {
      setUploadingPhoto(false);
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
          username: values.username,
          title: values.title || null,
          last_name: values.lastName,
          first_name: values.firstName,
          institution: values.institution,
          department: values.department,
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
    <Dialog open={open} onOpenChange={onOpenChange}>
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

          <div className="flex items-center gap-4">
            <Avatar url={avatarUrl} size={56} />
            <div className="grid gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_IMAGE_TYPES.join(",")}
                className="hidden"
                onChange={handlePhotoChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploadingPhoto}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadingPhoto ? "Uploading..." : "Change photo"}
              </Button>
              <p className="text-xs text-muted-foreground">PNG, JPEG, WebP, or GIF, up to 8MB.</p>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="profile-username">Username</Label>
            <Input
              id="profile-username"
              placeholder="Optional — lets you sign in without your email"
              value={values.username}
              onChange={(e) => update("username", e.target.value)}
            />
          </div>

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

          <div className="grid gap-1.5">
            <Label htmlFor="profile-department">Department</Label>
            <Input
              id="profile-department"
              value={values.department}
              onChange={(e) => update("department", e.target.value)}
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
