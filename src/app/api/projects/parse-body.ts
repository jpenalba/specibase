import { FOCAL_GROUP_CATEGORIES, FocalGroupCategory } from "@/lib/focal-group";
import { ProjectStatus } from "@/lib/projects-store";
import { MARKER_STYLE_FIELDS } from "@/lib/fields";
import { customColumnIdFromKey } from "@/lib/sample-custom-columns-store";
import { LAYER_SHAPES, LayerShape } from "@/lib/layer-shapes";

const STATUSES: ProjectStatus[] = ["in_progress", "completed"];
const MARKER_STYLE_FIELD_KEYS = MARKER_STYLE_FIELDS.map((f) => f.key);

// Distinguishes "this key wasn't in the request at all" (undefined — skip
// it on an update) from "it was sent as an empty string" (still undefined
// after trimming, but createProject/updateProject turn that into null,
// clearing the field) — collapsing both to undefined up front would make
// clearing a field on an edit indistinguishable from not touching it.
function stringField(body: Record<string, unknown>, key: string): string | undefined {
  if (!(key in body)) return undefined;
  const value = body[key];
  return typeof value === "string" ? value : undefined;
}

export type ParsedProjectFields = {
  description?: string;
  start_date?: string;
  owner?: string;
  collaborators?: string;
  focal_group?: string;
  focal_region?: string;
  logo?: FocalGroupCategory | null;
  status?: ProjectStatus;
  background?: string;
  notes?: string;
  marker_style_field?: string | null;
  marker_color?: string | null;
  marker_shape?: LayerShape | null;
  marker_hide_no_value?: boolean;
};

// Shared between POST (create) and PATCH (update) — pulls the project
// detail fields out of a request body and validates the two enum-like
// ones (logo, status) rather than trusting whatever a client sends.
export function parseProjectFields(
  body: Record<string, unknown>
): ParsedProjectFields | { error: string } {
  let logo: FocalGroupCategory | null | undefined;
  if ("logo" in body) {
    if (body.logo === null || body.logo === "") {
      logo = null;
    } else if (typeof body.logo === "string" && FOCAL_GROUP_CATEGORIES.includes(body.logo as FocalGroupCategory)) {
      logo = body.logo as FocalGroupCategory;
    } else {
      return { error: `Unknown logo "${body.logo}"` };
    }
  }

  let status: ProjectStatus | undefined;
  if ("status" in body) {
    if (typeof body.status === "string" && STATUSES.includes(body.status as ProjectStatus)) {
      status = body.status as ProjectStatus;
    } else {
      return { error: `Unknown status "${body.status}"` };
    }
  }

  let markerStyleField: string | null | undefined;
  if ("marker_style_field" in body) {
    if (body.marker_style_field === null || body.marker_style_field === "") {
      markerStyleField = null;
    } else if (
      typeof body.marker_style_field === "string" &&
      (MARKER_STYLE_FIELD_KEYS.includes(body.marker_style_field) ||
        customColumnIdFromKey(body.marker_style_field) !== null)
    ) {
      markerStyleField = body.marker_style_field;
    } else {
      return { error: `Unknown marker style field "${body.marker_style_field}"` };
    }
  }

  let markerShape: LayerShape | null | undefined;
  if ("marker_shape" in body) {
    if (body.marker_shape === null || body.marker_shape === "") {
      markerShape = null;
    } else if (typeof body.marker_shape === "string" && LAYER_SHAPES.includes(body.marker_shape as LayerShape)) {
      markerShape = body.marker_shape as LayerShape;
    } else {
      return { error: `Unknown marker shape "${body.marker_shape}"` };
    }
  }

  let markerColor: string | null | undefined;
  if ("marker_color" in body) {
    markerColor = typeof body.marker_color === "string" && body.marker_color !== "" ? body.marker_color : null;
  }

  const markerHideNoValue: boolean | undefined =
    typeof body.marker_hide_no_value === "boolean" ? body.marker_hide_no_value : undefined;

  return {
    description: stringField(body, "description"),
    start_date: stringField(body, "start_date"),
    owner: stringField(body, "owner"),
    collaborators: stringField(body, "collaborators"),
    focal_group: stringField(body, "focal_group"),
    focal_region: stringField(body, "focal_region"),
    logo,
    status,
    background: stringField(body, "background"),
    notes: stringField(body, "notes"),
    marker_style_field: markerStyleField,
    marker_color: markerColor,
    marker_shape: markerShape,
    marker_hide_no_value: markerHideNoValue,
  };
}
