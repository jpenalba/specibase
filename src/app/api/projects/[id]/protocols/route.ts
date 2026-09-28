import { NextRequest, NextResponse } from "next/server";
import { linkProtocolsToProject, unlinkProtocolsFromProject } from "@/lib/projects-store";
import { getProtocol, listProjectProtocols } from "@/lib/protocols-store";
import { logActivity } from "@/lib/activity-log";
import { requireUser } from "@/lib/require-user";
import { requireProjectRole } from "@/lib/require-project-role";
import { apiError } from "@/lib/api-error";

function parseProtocolIds(body: unknown): string[] | null {
  if (!body || typeof body !== "object" || !("protocolIds" in body)) return null;
  const ids = (body as { protocolIds: unknown }).protocolIds;
  if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string")) return null;
  return ids;
}

// Every protocol attached to this project, regardless of who owns it —
// see protocols-store.ts's listProjectProtocols.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const { id } = await params;
    const roleAuth = await requireProjectRole(auth.user.id, id, "viewer");
    if ("response" in roleAuth) return roleAuth.response;

    const protocols = await listProjectProtocols(id);
    return NextResponse.json({ protocols });
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

    const protocolIds = parseProtocolIds(await request.json());
    if (!protocolIds) {
      return NextResponse.json(
        { errors: ["protocolIds must be an array of strings"] },
        { status: 400 }
      );
    }
    // Only ever attach protocols the caller actually owns — a picker
    // fetching from the (owner-scoped) /api/protocols only ever offers
    // those anyway, so this is defense in depth against a crafted request.
    const owned: string[] = [];
    for (const protocolId of protocolIds) {
      const protocol = await getProtocol(protocolId, auth.user.id);
      if (protocol) owned.push(protocolId);
    }
    await linkProtocolsToProject(owned, id);
    for (const protocolId of owned) {
      const protocol = await getProtocol(protocolId, auth.user.id);
      if (protocol) {
        await logActivity(
          "protocol",
          "attached",
          `Attached protocol "${protocol.name}" to this project`,
          undefined,
          id
        );
      }
    }
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

    const protocolIds = parseProtocolIds(await request.json());
    if (!protocolIds) {
      return NextResponse.json(
        { errors: ["protocolIds must be an array of strings"] },
        { status: 400 }
      );
    }
    const attached = await listProjectProtocols(id);
    const names = new Map(attached.map((p) => [p.id, p.name]));
    await unlinkProtocolsFromProject(protocolIds, id);
    for (const protocolId of protocolIds) {
      const name = names.get(protocolId);
      if (name) {
        await logActivity("protocol", "detached", `Detached protocol "${name}" from this project`, undefined, id);
      }
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
