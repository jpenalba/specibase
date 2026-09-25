import { NextRequest, NextResponse } from "next/server";
import {
  listMarkerStyles,
  upsertMarkerStyle,
  removeMarkerStyle,
} from "@/lib/project-marker-styles-store";
import { markerStyleFieldByKey } from "@/lib/fields";
import { customColumnIdFromKey } from "@/lib/sample-custom-columns-store";
import { LAYER_SHAPES, LayerShape } from "@/lib/layer-shapes";
import { apiError } from "@/lib/api-error";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const styles = await listMarkerStyles(id);
    return NextResponse.json({ styles });
  } catch (error) {
    return apiError(error);
  }
}

// One value's color+shape override — field_key must be one of the fields
// samples can be colored by (see MARKER_STYLE_FIELDS) or a sample's
// "custom:<column id>" field, not just any string, so an override can't
// silently target a field the UI would never show.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const fieldKey = typeof body?.field_key === "string" ? body.field_key : "";
    if (!markerStyleFieldByKey(fieldKey) && customColumnIdFromKey(fieldKey) === null) {
      return NextResponse.json({ errors: [`Unknown marker style field "${fieldKey}"`] }, { status: 400 });
    }
    const fieldValue = typeof body?.field_value === "string" ? body.field_value : undefined;
    if (fieldValue === undefined) {
      return NextResponse.json({ errors: ["field_value is required"] }, { status: 400 });
    }
    const color = typeof body?.color === "string" ? body.color : "";
    if (!color) {
      return NextResponse.json({ errors: ["color is required"] }, { status: 400 });
    }
    const shape: LayerShape | undefined = LAYER_SHAPES.includes(body?.shape) ? body.shape : undefined;
    if (!shape) {
      return NextResponse.json({ errors: [`Unknown marker shape "${body?.shape}"`] }, { status: 400 });
    }

    const style = await upsertMarkerStyle(id, fieldKey, fieldValue, color, shape);
    return NextResponse.json({ style });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const fieldKey = typeof body?.field_key === "string" ? body.field_key : "";
    const fieldValue = typeof body?.field_value === "string" ? body.field_value : "";
    if (!fieldKey || !fieldValue) {
      return NextResponse.json({ errors: ["field_key and field_value are required"] }, { status: 400 });
    }
    await removeMarkerStyle(id, fieldKey, fieldValue);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
