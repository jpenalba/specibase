import { getSupabase } from "./supabase";
import { LayerShape } from "./layer-shapes";

const TABLE = "project_marker_styles";

export type MarkerStyle = {
  id: string;
  project_id: string;
  created_at: string;
  field_key: string;
  field_value: string;
  color: string;
  shape: LayerShape;
};

// Every override for this project across every field it's ever been
// colored by (not just the currently-selected marker_style_field) — see
// the migration's note on why old rows aren't deleted on a field switch.
export async function listMarkerStyles(projectId: string): Promise<MarkerStyle[]> {
  const { data, error } = await getSupabase().from(TABLE).select("*").eq("project_id", projectId);
  if (error) throw new Error(error.message);
  return (data ?? []) as MarkerStyle[];
}

// One value's color/shape, created or replaced — the picker always submits
// both together, so there's no partial-update case to handle here unlike
// e.g. updateBioNotesBlock.
export async function upsertMarkerStyle(
  projectId: string,
  fieldKey: string,
  fieldValue: string,
  color: string,
  shape: LayerShape
): Promise<MarkerStyle> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .upsert(
      { project_id: projectId, field_key: fieldKey, field_value: fieldValue, color, shape },
      { onConflict: "project_id,field_key,field_value" }
    )
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as MarkerStyle;
}

// Clears a manual override, letting that value fall back to its
// automatically-assigned color again.
export async function removeMarkerStyle(
  projectId: string,
  fieldKey: string,
  fieldValue: string
): Promise<void> {
  const { error } = await getSupabase()
    .from(TABLE)
    .delete()
    .eq("project_id", projectId)
    .eq("field_key", fieldKey)
    .eq("field_value", fieldValue);
  if (error) throw new Error(error.message);
}
