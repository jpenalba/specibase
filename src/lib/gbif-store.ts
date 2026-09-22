import { getSupabase } from "./supabase";

const TABLE = "gbif_species_layers";
const UNIQUE_VIOLATION = "23505";

export type GbifSpeciesLayer = {
  id: string;
  created_at: string;
  taxon_key: number;
  scientific_name: string;
  rank: string | null;
  style: string;
};

export type NewGbifSpeciesLayerInput = {
  taxon_key: number;
  scientific_name: string;
  rank?: string | null;
  style: string;
};

export async function listGbifSpeciesLayers(): Promise<GbifSpeciesLayer[]> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("*")
    .order("scientific_name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as GbifSpeciesLayer[];
}

export async function createGbifSpeciesLayer(
  input: NewGbifSpeciesLayerInput
): Promise<GbifSpeciesLayer> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .insert({
      taxon_key: input.taxon_key,
      scientific_name: input.scientific_name.trim(),
      rank: input.rank ?? null,
      style: input.style,
    })
    .select()
    .single();
  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      throw new Error(`"${input.scientific_name}" is already on the map.`);
    }
    throw new Error(error.message);
  }
  return data as GbifSpeciesLayer;
}

export async function deleteGbifSpeciesLayer(id: string): Promise<void> {
  const { error } = await getSupabase().from(TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}
