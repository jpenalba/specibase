import { NextRequest, NextResponse } from "next/server";
import { listGbifSpeciesLayers, createGbifSpeciesLayer } from "@/lib/gbif-store";
import { isGbifStyle, DEFAULT_GBIF_STYLE } from "@/lib/gbif";
import { apiError } from "@/lib/api-error";

export async function GET() {
  try {
    const layers = await listGbifSpeciesLayers();
    return NextResponse.json({ layers });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const taxonKey = Number(body?.taxon_key);
    const scientificName =
      typeof body?.scientific_name === "string" ? body.scientific_name.trim() : "";

    if (!Number.isFinite(taxonKey) || taxonKey <= 0) {
      return NextResponse.json({ errors: ["A valid GBIF species is required"] }, { status: 400 });
    }
    if (!scientificName) {
      return NextResponse.json({ errors: ["Scientific name is required"] }, { status: 400 });
    }
    const style =
      typeof body?.style === "string" && isGbifStyle(body.style) ? body.style : DEFAULT_GBIF_STYLE;

    const layer = await createGbifSpeciesLayer({
      taxon_key: taxonKey,
      scientific_name: scientificName,
      rank: typeof body?.rank === "string" ? body.rank : null,
      style,
    });
    return NextResponse.json({ layer }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
