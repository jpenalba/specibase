import { NextRequest, NextResponse } from "next/server";
import { uploadAvatar } from "@/lib/profile-store";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/image-types";
import { requireUser } from "@/lib/require-user";
import { apiError } from "@/lib/api-error";

// Always the caller's own photo — same as the rest of /api/profile.
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ errors: ["No file uploaded"] }, { status: 400 });
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json(
        { errors: [`Unsupported image type "${file.type || "unknown"}"`] },
        { status: 400 }
      );
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { errors: [`Image is too large — max ${Math.floor(MAX_IMAGE_BYTES / (1024 * 1024))}MB`] },
        { status: 400 }
      );
    }

    const profile = await uploadAvatar(auth.user.id, file);
    return NextResponse.json({ profile }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
