import { NextRequest, NextResponse } from "next/server";
import { insertSample, readSamples } from "@/lib/samples-store";
import { requireUser } from "@/lib/require-user";
import { apiError } from "@/lib/api-error";

export async function GET() {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    return NextResponse.json({ samples: await readSamples(auth.user.id) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    if ("response" in auth) return auth.response;
    const body = await request.json();
    const result = await insertSample(body, auth.user.id);
    if (!result.ok) {
      return NextResponse.json({ errors: result.errors }, { status: 400 });
    }
    return NextResponse.json({ sample: result.sample }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
