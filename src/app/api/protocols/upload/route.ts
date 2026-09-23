import { NextRequest, NextResponse } from "next/server";
import { uploadProtocolPdf } from "@/lib/protocols-store";
import { ALLOWED_PROTOCOL_FILE_TYPES, MAX_PROTOCOL_PDF_BYTES } from "@/lib/protocol-files";
import { apiError } from "@/lib/api-error";

// Uploads a protocol's PDF ahead of the protocol record itself — the
// create dialog calls this first, then sends the resulting URL along with
// the rest of the protocol's fields to POST /api/protocols.
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ errors: ["No file uploaded"] }, { status: 400 });
    }
    if (!ALLOWED_PROTOCOL_FILE_TYPES.includes(file.type)) {
      return NextResponse.json(
        { errors: [`Unsupported file type "${file.type || "unknown"}" — PDF only`] },
        { status: 400 }
      );
    }
    if (file.size > MAX_PROTOCOL_PDF_BYTES) {
      return NextResponse.json(
        {
          errors: [
            `File is too large — max ${Math.floor(MAX_PROTOCOL_PDF_BYTES / (1024 * 1024))}MB`,
          ],
        },
        { status: 400 }
      );
    }

    const { url, filename } = await uploadProtocolPdf(file);
    return NextResponse.json({ url, filename }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
