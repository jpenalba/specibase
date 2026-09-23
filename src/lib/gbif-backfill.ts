import { getSupabase } from "./supabase";
import { matchGbifSpeciesBatch } from "./gbif";

export type BackfillResult = {
  samplesUpdated: number;
  collectionSamplesUpdated: number;
  unmatchedSpecies: string[];
};

async function backfillTable(
  table: "samples" | "collection_samples"
): Promise<{ updated: number; unmatched: Set<string> }> {
  const supabase = getSupabase();
  // Only rows where all four taxonomy columns are still blank — a sample
  // that already has some (typed by hand, or from an earlier backfill run)
  // is left alone rather than second-guessed.
  const { data, error } = await supabase
    .from(table)
    .select("id, species")
    .is("genus", null)
    .is("family", null)
    .is("taxon_order", null)
    .is("taxon_class", null)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as { id: string; species: string }[];
  const unmatched = new Set<string>();
  if (rows.length === 0) return { updated: 0, unmatched };

  const taxonomyByName = await matchGbifSpeciesBatch(rows.map((r) => r.species));
  let updated = 0;

  for (const row of rows) {
    const match = taxonomyByName.get(row.species?.trim() ?? "");
    if (!match) {
      unmatched.add(row.species);
      continue;
    }
    const { error: updateError } = await supabase
      .from(table)
      .update({
        genus: match.genus ?? null,
        family: match.family ?? null,
        taxon_order: match.order ?? null,
        taxon_class: match.class ?? null,
      })
      .eq("id", row.id);
    if (updateError) throw new Error(updateError.message);
    updated += 1;
  }

  return { updated, unmatched };
}

// One-time pass over every existing sample (main database and every
// collection) whose taxonomy columns are all still blank — fills them in
// from a GBIF species/match lookup, one lookup per distinct species name
// rather than per row. Anything GBIF can't confidently place is left
// blank, same as it would be for a brand new sample.
export async function backfillSpeciesTaxonomy(): Promise<BackfillResult> {
  const [samplesResult, collectionResult] = await Promise.all([
    backfillTable("samples"),
    backfillTable("collection_samples"),
  ]);
  const unmatchedSpecies = [
    ...new Set([...samplesResult.unmatched, ...collectionResult.unmatched]),
  ];
  return {
    samplesUpdated: samplesResult.updated,
    collectionSamplesUpdated: collectionResult.updated,
    unmatchedSpecies,
  };
}
