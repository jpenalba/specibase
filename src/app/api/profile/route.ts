import { NextRequest, NextResponse } from "next/server";
import { getProfile, updateProfile, PROFILE_TITLES } from "@/lib/profile-store";
import { requireUser } from "@/lib/require-user";
import { apiError } from "@/lib/api-error";

// Always the caller's own profile — there's no id in this route, since
// there's nothing to look up but "whoever's signed in."
export async function GET() {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const profile = await getProfile(auth.user.id);
    return NextResponse.json({ profile });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const body = await request.json();

    let title: (typeof PROFILE_TITLES)[number] | null | undefined;
    if ("title" in body) {
      if (body.title === null || body.title === "") {
        title = null;
      } else if (typeof body.title === "string" && PROFILE_TITLES.includes(body.title as never)) {
        title = body.title as (typeof PROFILE_TITLES)[number];
      } else {
        return NextResponse.json(
          { errors: [`Title must be one of: ${PROFILE_TITLES.join(", ")}, or None`] },
          { status: 400 }
        );
      }
    }

    const stringField = (key: string): string | null | undefined => {
      if (!(key in body)) return undefined;
      return typeof body[key] === "string" ? body[key] : "";
    };

    const result = await updateProfile(auth.user.id, {
      title,
      username: stringField("username"),
      last_name: stringField("last_name"),
      first_name: stringField("first_name"),
      institution: stringField("institution"),
      department: stringField("department"),
      position: stringField("position"),
      lab_group: stringField("lab_group"),
      log_enabled: typeof body.log_enabled === "boolean" ? body.log_enabled : undefined,
    });
    if (!result.ok) {
      return NextResponse.json({ errors: result.errors }, { status: 400 });
    }
    return NextResponse.json({ profile: result.profile });
  } catch (error) {
    return apiError(error);
  }
}
