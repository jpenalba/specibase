"use client";

import { useEffect, useState } from "react";
import { CollaboratorWithProfile } from "@/lib/collaborators-store";

function collaboratorName(c: CollaboratorWithProfile): string {
  return c.display_name ?? c.username ?? c.email;
}

// A quick-pick dropdown of the caller's saved collaborators (see
// collaborators-store.ts and /collaborators) for a Members dialog's "Add
// member" form — picking one just fills in the identifier field via
// `onPick`; typing a brand-new identifier by hand still works exactly as
// before. Renders nothing once there are no collaborators to show, so it
// never clutters the form before someone's actually added one.
export function CollaboratorPicker({ onPick }: { onPick: (identifier: string) => void }) {
  const [collaborators, setCollaborators] = useState<CollaboratorWithProfile[]>([]);

  useEffect(() => {
    fetch("/api/collaborators")
      .then((res) => res.json())
      .then((data) => setCollaborators(data.collaborators ?? []))
      .catch(() => {
        // Silent — the free-text identifier input still works without this.
      });
  }, []);

  if (collaborators.length === 0) return null;

  return (
    <select
      value=""
      onChange={(e) => {
        if (e.target.value) onPick(e.target.value);
      }}
      className="h-9 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="Pick a collaborator"
    >
      <option value="">Pick a collaborator...</option>
      {collaborators.map((c) => (
        <option key={c.id} value={c.email}>
          {collaboratorName(c)}
        </option>
      ))}
    </select>
  );
}
