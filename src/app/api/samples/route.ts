import { NextRequest, NextResponse } from "next/server";
import { insertSample, readSamples } from "@/lib/samples-store";

export async function GET() {
  return NextResponse.json({ samples: readSamples() });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = insertSample(body);
  if (!result.ok) {
    return NextResponse.json({ errors: result.errors }, { status: 400 });
  }
  return NextResponse.json({ sample: result.sample }, { status: 201 });
}
