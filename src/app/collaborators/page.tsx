"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { CollaboratorWithProfile } from "@/lib/collaborators-store";
import { Avatar } from "@/components/account/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function collaboratorName(c: CollaboratorWithProfile): string {
  return c.display_name ?? c.username ?? c.email;
}

// The caller's own address book of people they often share projects and
// collections with — add someone once here, then pick them off the
// CollaboratorPicker dropdown in a Members dialog instead of retyping
// their email or username every time. Unlike project/collection
// membership, this is purely personal: adding or removing a collaborator
// here has no effect on anything they've actually been shared.
export default function CollaboratorsPage() {
  const [collaborators, setCollaborators] = useState<CollaboratorWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    fetch("/api/collaborators")
      .then((res) => res.json())
      .then((data) => {
        if (data.errors?.length > 0) {
          setError(data.errors.join(" "));
        } else {
          setError(null);
          setCollaborators(data.collaborators ?? []);
        }
      })
      .catch(() => setError("Couldn't reach the server."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/collaborators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.errors?.join(" ") ?? "Couldn't add that person.");
        return;
      }
      setIdentifier("");
      setFormOpen(false);
      load();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/collaborators/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.errors?.join(" ") ?? "Couldn't remove that person.");
        return;
      }
      load();
    } catch {
      setError("Couldn't reach the server.");
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6 sm:p-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Collaborators</h1>
          <p className="text-sm text-muted-foreground">
            People you often share projects and collections with. Add
            someone here once, and they&apos;ll show up in a dropdown
            every time you share something — you can still add anyone
            else by email or username too.
          </p>
        </div>
        <Button onClick={() => setFormOpen((open) => !open)}>Add collaborator</Button>
      </div>

      {formOpen && (
        <form onSubmit={handleAdd} className="flex gap-2 rounded-lg border border-border p-4">
          <Input
            autoFocus
            placeholder="Email or username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={adding || !identifier.trim()}>
            {adding ? "Adding..." : "Add"}
          </Button>
        </form>
      )}

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : collaborators.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No collaborators yet. Add one to get started.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {collaborators.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-md border border-border p-2">
              <Avatar url={c.avatar_url} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{collaboratorName(c)}</p>
                <p className="truncate text-xs text-muted-foreground">{c.email}</p>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(c.id)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                aria-label={`Remove ${collaboratorName(c)}`}
                title="Remove"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
