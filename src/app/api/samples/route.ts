import { NextRequest, NextResponse } from "next/server";
import { insertSample, readSamples } from "@/lib/samples-store";
import { apiError } from "@/lib/api-error";

export async function GET() {
  try {
    return NextResponse.json({ samples: await readSamples() });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await insertSample(body);
    if (!result.ok) {
      return NextResponse.json({ errors: result.errors }, { status: 400 });
    }
    return NextResponse.json({ sample: result.sample }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
