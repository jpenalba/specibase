import { NextResponse } from "next/server";
import { getSupabase } from "./supabase";
import { ProjectRole, getMemberRole, roleAtLeast } from "./project-members-store";

// Highest role `userId` holds across any of `projectIds` — a sample or
// protocol can be linked into several projects at once, and the caller
// only needs to qualify via one of them.
async function bestProjectRole(userId: string, projectIds: string[]): Promise<ProjectRole | null> {
  let best: ProjectRole | null = null;
  for (const projectId of projectIds) {
    const role = await getMemberRole(projectId, userId);
    if (role && (!best || roleAtLeast(role, best))) best = role;
  }
  return best;
}

type AccessResult = { ownerId: string } | { response: NextResponse };

// Samples and protocols carry a personal `owner_id` (Phase 2's private-
// Database scoping) but can also be linked into a shared project — per
// AUTH_AND_PERMISSIONS_PLAN.md, "linked into Project X via sample_projects
// so everyone on that project can see and edit it there," not just its
// owner. This is the authorization check for that: the caller either owns
// the row outright, or holds at least `minRole` on some project it's
// linked to. Either way, returns the row's *actual* owner_id (not the
// caller's id) so the route can still call updateSample/deleteSample etc.
// with the ownerId their existing `.eq("owner_id", ownerId)` queries need.
export async function requireSampleAccess(
  userId: string,
  sampleId: string,
  minRole: ProjectRole
): Promise<AccessResult> {
  const { data, error } = await getSupabase()
    .from("samples")
    .select("owner_id")
    .eq("id", sampleId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    return { response: NextResponse.json({ errors: ["Sample not found"] }, { status: 404 }) };
  }
  const ownerId = data.owner_id as string;
  if (ownerId === userId) return { ownerId };

  const { data: links, error: linksError } = await getSupabase()
    .from("sample_projects")
    .select("project_id")
    .eq("sample_id", sampleId);
  if (linksError) throw new Error(linksError.message);
  const role = await bestProjectRole(userId, (links ?? []).map((l) => l.project_id as string));
  if (role && roleAtLeast(role, minRole)) return { ownerId };

  return {
    response: NextResponse.json({ errors: ["Not authorized for this sample"] }, { status: 403 }),
  };
}

export async function requireProtocolAccess(
  userId: string,
  protocolId: string,
  minRole: ProjectRole
): Promise<AccessResult> {
  const { data, error } = await getSupabase()
    .from("protocols")
    .select("owner_id")
    .eq("id", protocolId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    return { response: NextResponse.json({ errors: ["Protocol not found"] }, { status: 404 }) };
  }
  const ownerId = data.owner_id as string;
  if (ownerId === userId) return { ownerId };

  const { data: links, error: linksError } = await getSupabase()
    .from("protocol_projects")
    .select("project_id")
    .eq("protocol_id", protocolId);
  if (linksError) throw new Error(linksError.message);
  const role = await bestProjectRole(userId, (links ?? []).map((l) => l.project_id as string));
  if (role && roleAtLeast(role, minRole)) return { ownerId };

  return {
    response: NextResponse.json({ errors: ["Not authorized for this protocol"] }, { status: 403 }),
  };
}
