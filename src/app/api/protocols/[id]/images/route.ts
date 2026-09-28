import { NextRequest, NextResponse } from "next/server";
import { getProtocol, uploadProtocolImage } from "@/lib/protocols-store";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/image-types";
import { requireUser } from "@/lib/require-user";
import { apiError } from "@/lib/api-error";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const { id } = await params;
    if (!(await getProtocol(id, auth.user.id))) {
      return NextResponse.json({ errors: ["Protocol not found"] }, { status: 404 });
    }
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

    const url = await uploadProtocolImage(id, file);
    return NextResponse.json({ url }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
