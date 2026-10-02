"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, X } from "lucide-react";
import { CollectionMemberWithProfile, CollectionRole, COLLECTION_ROLES } from "@/lib/collection-members-store";
import { CollaboratorPicker } from "@/components/collaborators/collaborator-picker";
import { Avatar } from "@/components/account/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";

const ROLE_LABELS: Record<CollectionRole, string> = {
  viewer: "Viewer",
  editor: "Editor",
  owner: "Owner",
};

function memberName(member: CollectionMemberWithProfile): string {
  return member.display_name ?? member.username ?? member.email;
}

// The collection's membership list — visible to any member, but only an
// Owner can add someone, change a role, or remove anyone but themselves.
// Mirrors MembersDialog (projects) exactly, just pointed at
// /api/collections/[id]/members instead.
export function CollectionMembersDialog({
  collectionId,
  currentUserId,
  viewerRole,
}: {
  collectionId: string;
  currentUserId: string;
  viewerRole: CollectionRole | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<CollectionMemberWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [identifier, setIdentifier] = useState("");
  const [newRole, setNewRole] = useState<CollectionRole>("editor");
  const [adding, setAdding] = useState(false);
  const [addNotice, setAddNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/collections/${collectionId}/members`)
      .then((res) => res.json())
      .then((data) => {
        if (data.errors?.length > 0) {
          setError(data.errors.join(" "));
        } else {
          setError(null);
          setMembers(data.members ?? []);
        }
      })
      .catch(() => setError("Couldn't reach the server."))
      .finally(() => setLoading(false));
  }, [collectionId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const isOwner = viewerRole === "owner";

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier.trim()) return;
    setAdding(true);
    setError(null);
    setAddNotice(null);
    try {
      const res = await fetch(`/api/collections/${collectionId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.errors?.join(" ") ?? "Couldn't add that person.");
        return;
      }
      setAddNotice(
        data.resent
          ? `Re-sent the invite to ${identifier} — they hadn't accepted it yet.`
          : data.invited
            ? `Invited ${identifier} by email.`
            : `Added ${identifier}.`
      );
      setIdentifier("");
      load();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setAdding(false);
    }
  }

  async function handleRoleChange(userId: string, role: CollectionRole) {
    setError(null);
    try {
      const res = await fetch(`/api/collections/${collectionId}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.errors?.join(" ") ?? "Couldn't change that role.");
        return;
      }
      load();
    } catch {
      setError("Couldn't reach the server.");
    }
  }

  async function handleRemove(userId: string, isSelf: boolean) {
    if (isSelf && !window.confirm("Leave this collection?")) return;
    setError(null);
    try {
      const res = await fetch(`/api/collections/${collectionId}/members/${userId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.errors?.join(" ") ?? "Couldn't remove that person.");
        return;
      }
      if (isSelf) {
        router.push("/collections");
        return;
      }
      load();
    } catch {
      setError("Couldn't reach the server.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Users className="size-4" />
          Members
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Collection members</DialogTitle>
          <DialogDescription>
            {isOwner
              ? "Everyone with access to this collection, and their role."
              : "Everyone with access to this collection."}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <div className="flex flex-col gap-2">
            {members.map((member) => {
              const isSelf = member.user_id === currentUserId;
              return (
                <div
                  key={member.user_id}
                  className="flex items-center gap-3 rounded-md border border-border p-2"
                >
                  <Avatar url={member.avatar_url} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {memberName(member)}
                      {isSelf && " (you)"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                  </div>
                  {isOwner && !isSelf ? (
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.user_id, e.target.value as CollectionRole)}
                      className="h-8 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {COLLECTION_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-muted-foreground">{ROLE_LABELS[member.role]}</span>
                  )}
                  {(isOwner || isSelf) && (
                    <button
                      type="button"
                      onClick={() => handleRemove(member.user_id, isSelf)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      aria-label={isSelf ? "Leave collection" : `Remove ${memberName(member)}`}
                      title={isSelf ? "Leave collection" : "Remove"}
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {isOwner && (
          <form onSubmit={handleAdd} className="flex flex-col gap-2 border-t border-border pt-4">
            <Label htmlFor="collection-member-identifier">Add member</Label>
            {addNotice && <p className="text-xs text-muted-foreground">{addNotice}</p>}
            <div className="flex flex-wrap gap-2">
              <Input
                id="collection-member-identifier"
                placeholder="Email or username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="flex-1"
              />
              <CollaboratorPicker onPick={setIdentifier} />
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as CollectionRole)}
                className="h-9 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {COLLECTION_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
              <Button type="submit" disabled={adding || !identifier.trim()}>
                {adding ? "Adding..." : "Add"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              An unknown email gets an invite to create an account.
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
