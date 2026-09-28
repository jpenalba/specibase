import { NextRequest, NextResponse } from "next/server";
import { linkSamplesToProject, unlinkSamplesFromProject } from "@/lib/projects-store";
import { filterOwnedSampleIds, readProjectSamples } from "@/lib/samples-store";
import { requireUser } from "@/lib/require-user";
import { requireProjectRole } from "@/lib/require-project-role";
import { apiError } from "@/lib/api-error";

function parseSampleIds(body: unknown): string[] | null {
  if (!body || typeof body !== "object" || !("sampleIds" in body)) return null;
  const ids = (body as { sampleIds: unknown }).sampleIds;
  if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string")) return null;
  return ids;
}

// Every sample linked to this project, regardless of who owns it — see
// samples-store.ts's readProjectSamples.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const { id } = await params;
    const roleAuth = await requireProjectRole(auth.user.id, id, "viewer");
    if ("response" in roleAuth) return roleAuth.response;

    const samples = await readProjectSamples(id);
    return NextResponse.json({ samples });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const { id } = await params;
    const roleAuth = await requireProjectRole(auth.user.id, id, "editor");
    if ("response" in roleAuth) return roleAuth.response;

    const sampleIds = parseSampleIds(await request.json());
    if (!sampleIds) {
      return NextResponse.json({ errors: ["sampleIds must be an array of strings"] }, { status: 400 });
    }
    // Only ever link samples the caller actually owns — the picker
    // offering them (owner-scoped /api/samples) already only shows those
    // anyway, so this is defense in depth against a crafted request.
    const owned = await filterOwnedSampleIds(auth.user.id, sampleIds);
    await linkSamplesToProject(owned, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const { id } = await params;
    const roleAuth = await requireProjectRole(auth.user.id, id, "editor");
    if ("response" in roleAuth) return roleAuth.response;

    const sampleIds = parseSampleIds(await request.json());
    if (!sampleIds) {
      return NextResponse.json({ errors: ["sampleIds must be an array of strings"] }, { status: 400 });
    }
    await unlinkSamplesFromProject(sampleIds, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
