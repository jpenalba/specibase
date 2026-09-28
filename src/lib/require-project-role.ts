import { NextResponse } from "next/server";
import { getMemberRole, ProjectRole, roleAtLeast } from "./project-members-store";

// The project-scoped counterpart to require-user.ts's requireUser — every
// route that reads or writes data scoped to one project (the project
// itself, its samples/protocols links, workflows, notes, references,
// marker styles, activity log) calls this after requireUser, with
// whatever role that action needs at minimum.
export async function requireProjectRole(
  userId: string,
  projectId: string,
  minRole: ProjectRole
): Promise<{ role: ProjectRole } | { response: NextResponse }> {
  const role = await getMemberRole(projectId, userId);
  if (!role || !roleAtLeast(role, minRole)) {
    return {
      response: NextResponse.json({ errors: ["Not authorized for this project"] }, { status: 403 }),
    };
  }
  return { role };
}

// For routes keyed by some other entity's id (a workflow, say) whose row
// itself carries `project_id` — fetches it, 404s if it doesn't exist, then
// applies the same role check. `getEntity` is whatever store lookup
// already exists for that entity (e.g. getWorkflow).
export async function requireEntityProjectRole<T extends { project_id: string }>(
  userId: string,
  getEntity: () => Promise<T | null>,
  minRole: ProjectRole
): Promise<{ entity: T; role: ProjectRole } | { response: NextResponse }> {
  const entity = await getEntity();
  if (!entity) {
    return { response: NextResponse.json({ errors: ["Not found"] }, { status: 404 }) };
  }
  const auth = await requireProjectRole(userId, entity.project_id, minRole);
  if ("response" in auth) return auth;
  return { entity, role: auth.role };
}
