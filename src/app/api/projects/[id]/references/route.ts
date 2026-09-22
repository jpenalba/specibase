import { NextRequest, NextResponse } from "next/server";
import {
  addManualReference,
  addReferenceFromMetadata,
  listReferences,
} from "@/lib/project-references-store";
import { CitationMetadata } from "@/lib/citation-metadata";
import { apiError } from "@/lib/api-error";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const references = await listReferences(id);
    return NextResponse.json({ references });
  } catch (error) {
    return apiError(error);
  }
}

// Loosely validates a client-supplied metadata object (echoed back from a
// /api/crossref/search result the user picked) rather than trusting its
// shape outright — the citation itself is still formatted server-side.
function parseMetadata(body: unknown): CitationMetadata | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid metadata" };
  const m = body as Record<string, unknown>;
  if (typeof m.doi !== "string" || !m.doi) return { error: "metadata.doi is required" };
  if (typeof m.title !== "string" || !m.title) return { error: "metadata.title is required" };
  if (!Array.isArray(m.authors)) return { error: "metadata.authors must be an array" };
  const authors = [];
  for (const a of m.authors) {
    if (!a || typeof a !== "object" || typeof (a as Record<string, unknown>).family !== "string") {
      return { error: "Invalid author" };
    }
    const { given, family } = a as { given?: unknown; family: string };
    authors.push({ given: typeof given === "string" ? given : undefined, family });
  }
  return {
    doi: m.doi,
    title: m.title,
    authors,
    year: typeof m.year === "number" ? m.year : null,
    journal: typeof m.journal === "string" ? m.journal : null,
    volume: typeof m.volume === "string" ? m.volume : null,
    issue: typeof m.issue === "string" ? m.issue : null,
    pages: typeof m.pages === "string" ? m.pages : null,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if ("metadata" in body) {
      const metadata = parseMetadata(body.metadata);
      if ("error" in metadata) {
        return NextResponse.json({ errors: [metadata.error] }, { status: 400 });
      }
      const reference = await addReferenceFromMetadata(id, metadata);
      return NextResponse.json({ reference }, { status: 201 });
    }

    if (typeof body?.citation === "string" && body.citation.trim()) {
      const reference = await addManualReference(id, body.citation);
      return NextResponse.json({ reference }, { status: 201 });
    }

    return NextResponse.json(
      { errors: ["Either metadata or a non-empty citation is required"] },
      { status: 400 }
    );
  } catch (error) {
    return apiError(error);
  }
}
