import { getSupabase } from "./supabase";
import { OPTIONAL_FIELDS } from "./fields";
import { RawRow, validateRow } from "./validation";
import { parseDDMMYYYY } from "./dates";

const TABLE = "samples";

export type SampleRecord = {
  id: string;
  created_at: string;
  primary_identifier: string;
  species: string;
  latitude?: number;
  longitude?: number;
  [optionalField: string]: string | number | undefined;
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

// Dates are entered/validated as DD-MM-YYYY but stored as ISO, since a
// Postgres `date` column parses dash-separated strings ambiguously.
function normalizeDatesForStorage(fields: RawRow): RawRow {
  const normalized: RawRow = { ...fields };
  for (const field of OPTIONAL_FIELDS) {
    if (field.type !== "date") continue;
    const raw = normalized[field.key];
    if (!raw) continue;
    const iso = parseDDMMYYYY(raw);
    if (iso) normalized[field.key] = iso;
  }
  return normalized;
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
  const insertValues: Record<string, string | number> = {
    primary_identifier: primary_identifier.trim(),
    species: species.trim(),
    ...normalizeDatesForStorage(rest),
  };
  // Coordinates are optional (see validateRow) — omit them rather than
  // storing Number("") as 0, which would be a real, wrong latitude.
  if (latitude?.trim()) insertValues.latitude = Number(latitude);
  if (longitude?.trim()) insertValues.longitude = Number(longitude);

  const { data, error } = await getSupabase()
    .from(TABLE)
    .insert(insertValues)
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
  // Non-empty means no rows were inserted at all — a duplicate Sample ID
  // (within the file, or against the database) blocks the whole upload
  // rather than just being skipped like other row-level errors.
  duplicateIds: string[];
};

export async function insertSamplesBulk(
  rows: RawRow[]
): Promise<BulkImportResult> {
  const seen = await existingIdentifiers();
  const duplicateIds = new Set<string>();

  for (const row of rows) {
    const id = row.primary_identifier?.trim();
    if (!id) continue;
    if (seen.has(id)) {
      duplicateIds.add(id);
    } else {
      seen.add(id);
    }
  }

  if (duplicateIds.size > 0) {
    return { inserted: [], skipped: [], duplicateIds: [...duplicateIds] };
  }

  const inserted: SampleRecord[] = [];
  const skipped: { row: number; errors: string[] }[] = [];

  // Inserted one at a time (rather than a single bulk write) so each
  // row is independently validated and a bad row doesn't sink the batch.
  for (const [index, row] of rows.entries()) {
    const result = await insertSample(row);
    if (result.ok) {
      inserted.push(result.sample);
    } else {
      skipped.push({ row: index, errors: result.errors });
    }
  }

  return { inserted, skipped, duplicateIds: [] };
}
