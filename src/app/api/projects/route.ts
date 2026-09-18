import { NextRequest, NextResponse } from "next/server";
import { getOrCreateProject, listProjects } from "@/lib/projects-store";

export async function GET() {
  return NextResponse.json({ projects: await listProjects() });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ errors: ["Project name is required"] }, { status: 400 });
  }
  const project = await getOrCreateProject(name);
  return NextResponse.json({ project }, { status: 201 });
}
