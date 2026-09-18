import { getSupabase } from "./supabase";
import { RawRow, validateRow } from "./validation";

const TABLE = "samples";

export type SampleRecord = {
  id: string;
  created_at: string;
  primary_identifier: string;
  species: string;
  latitude: number;
  longitude: number;
  [optionalField: string]: string | number;
};

export async function readSamples(): Promise<SampleRecord[]> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SampleRecord[];
}

export async function existingIdentifiers(): Promise<Set<string>> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("primary_identifier");
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => row.primary_identifier as string));
}

export type InsertResult =
  | { ok: true; sample: SampleRecord }
  | { ok: false; errors: string[] };

export async function insertSample(row: RawRow): Promise<InsertResult> {
  const existingIds = await existingIdentifiers();
  const { errors } = validateRow(row, existingIds);
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const { primary_identifier, species, latitude, longitude, ...rest } = row;
  const { data, error } = await getSupabase()
    .from(TABLE)
    .insert({
      primary_identifier: primary_identifier.trim(),
      species: species.trim(),
      latitude: Number(latitude),
      longitude: Number(longitude),
      ...rest,
    })
    .select()
    .single();

  if (error) {
    // Unique-violation race (two imports landing the same ID at once) —
    // everything else was already caught by validateRow above.
    if (error.code === "23505") {
      return {
        ok: false,
        errors: [`Sample ID "${primary_identifier.trim()}" already exists`],
      };
    }
    return { ok: false, errors: [error.message] };
  }

  return { ok: true, sample: data as SampleRecord };
}

export type BulkImportResult = {
  inserted: SampleRecord[];
  skipped: { row: number; errors: string[] }[];
};

// Inserts rows one at a time (rather than validating all up front then
// writing once) so that a duplicate ID *within the same file* is caught
// against rows already inserted earlier in this same import.
export async function insertSamplesBulk(
  rows: RawRow[]
): Promise<BulkImportResult> {
  const inserted: SampleRecord[] = [];
  const skipped: { row: number; errors: string[] }[] = [];

  for (const [index, row] of rows.entries()) {
    const result = await insertSample(row);
    if (result.ok) {
      inserted.push(result.sample);
    } else {
      skipped.push({ row: index, errors: result.errors });
    }
  }

  return { inserted, skipped };
}
