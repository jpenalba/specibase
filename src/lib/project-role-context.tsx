"use client";

import { createContext, useContext } from "react";
import { ProjectRole } from "./project-members-store";

// Provided by the project layout (see src/app/projects/[id]/layout.tsx)
// once it's fetched the caller's own membership — null while still
// loading. Tab pages read this to hide edit affordances from Viewers,
// on top of (never instead of) the server-side requireProjectRole checks
// that actually enforce it.
export const ProjectRoleContext = createContext<ProjectRole | null>(null);

export function useProjectRole(): ProjectRole | null {
  return useContext(ProjectRoleContext);
}

export function canEdit(role: ProjectRole | null): boolean {
  return role === "editor" || role === "owner";
}
