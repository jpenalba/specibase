import { NextRequest, NextResponse } from "next/server";
import { addCollaborator, listCollaborators } from "@/lib/collaborators-store";
import { requireUser } from "@/lib/require-user";
import { apiError } from "@/lib/api-error";

// The caller's own saved collaborators — see collaborators-store.ts.
export async function GET() {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const collaborators = await listCollaborators(auth.user.id);
    return NextResponse.json({ collaborators });
  } catch (error) {
    return apiError(error);
  }
}

// "Add collaborator" — identifier must match an existing account; there's
// no invite flow here (that's what sharing a project/collection is for).
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const body = await request.json();
    const identifier = typeof body?.identifier === "string" ? body.identifier.trim() : "";
    if (!identifier) {
      return NextResponse.json({ errors: ["An email or username is required"] }, { status: 400 });
    }

    const result = await addCollaborator(auth.user.id, identifier);
    if (!result.ok) {
      return NextResponse.json({ errors: result.errors }, { status: 400 });
    }
    return NextResponse.json(
      { collaborator: result.collaborator, alreadyAdded: result.alreadyAdded },
      { status: 201 }
    );
  } catch (error) {
    return apiError(error);
  }
}
