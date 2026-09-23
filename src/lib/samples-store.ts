import { getSupabase } from "./supabase";
import { OPTIONAL_FIELDS, FieldDef } from "./fields";
import { RawRow, validateRow } from "./validation";
import { parseDDMMYYYY, formatToDDMMYYYY } from "./dates";
import { matchGbifSpeciesBatch, applyGbifClassificationToRow } from "./gbif";

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

// Turns a stored record back into the string-keyed shape an editable form
// or table cell works with — the inverse of the insert/update normalization
// below. Only pulls the given columns, so a caller editing just the
// currently-visible table columns doesn't have to know about the rest.
export function sampleToRawRow(sample: SampleRecord, columns: FieldDef[]): RawRow {
  const row: RawRow = {};
  for (const col of columns) {
    const raw = sample[col.key];
    if (raw === undefined || raw === null || raw === "") {
      row[col.key] = "";
      continue;
    }
    row[col.key] = col.type === "date" ? formatToDDMMYYYY(String(raw)) : String(raw);
  }
  return row;
}

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
// Exported for collections-store.ts's own samples table, which needs the
// same conversion.
export function normalizeDatesForStorage(fields: RawRow): RawRow {
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

// Partial update — only fields present as keys in `row` are changed, so a
// caller that only knows about a subset of columns (e.g. an editable
// table showing just the currently-visible optional fields) can't
// accidentally wipe out a column it never displayed.
export async function updateSample(id: string, rawRow: RawRow): Promise<InsertResult> {
  const { data: current, error: fetchError } = await getSupabase()
    .from(TABLE)
    .select("primary_identifier")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) return { ok: false, errors: [fetchError.message] };
  if (!current) return { ok: false, errors: ["Sample not found"] };

  // The Sample ID can't be changed once created — the only way to retire
  // one is to delete the row (see deleteSample). Whatever the caller sent
  // for it is overridden with the value already on file, both so
  // validateRow always sees a valid, non-colliding ID regardless of what
  // was submitted, and so the patch loop below never touches the column.
  const row = { ...rawRow, primary_identifier: current.primary_identifier as string };

  const existingIds = await existingIdentifiers();
  existingIds.delete(current.primary_identifier as string);
  const { errors } = validateRow(row, existingIds);
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const normalized = normalizeDatesForStorage(row);
  const patch: Record<string, string | number | null> = {};
  for (const key of Object.keys(rawRow)) {
    if (key === "primary_identifier") {
      continue;
    } else if (key === "species") {
      patch.species = normalized.species.trim();
    } else if (key === "latitude" || key === "longitude") {
      const value = normalized[key];
      patch[key] = value?.trim() ? Number(value) : null;
    } else {
      const value = normalized[key]?.trim();
      patch[key] = value ? value : null;
    }
  }

  const { data, error } = await getSupabase()
    .from(TABLE)
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        errors: [`Sample ID "${current.primary_identifier}" already exists`],
      };
    }
    return { ok: false, errors: [error.message] };
  }

  return { ok: true, sample: data as SampleRecord };
}

export type DeleteResult = { ok: true } | { ok: false; errors: string[] };

// Cascades to sample_projects (see supabase/schema.sql) — no separate
// cleanup needed for a sample's project links.
export async function deleteSample(id: string): Promise<DeleteResult> {
  const { error } = await getSupabase().from(TABLE).delete().eq("id", id);
  if (error) return { ok: false, errors: [error.message] };
  return { ok: true };
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

  // One GBIF lookup per distinct species in the batch, not per row.
  const taxonomyByName = await matchGbifSpeciesBatch(rows.map((r) => r.species ?? ""));

  const inserted: SampleRecord[] = [];
  const skipped: { row: number; errors: string[] }[] = [];

  // Inserted one at a time (rather than a single bulk write) so each
  // row is independently validated and a bad row doesn't sink the batch.
  for (const [index, row] of rows.entries()) {
    const result = await insertSample(applyGbifClassificationToRow(row, taxonomyByName));
    if (result.ok) {
      inserted.push(result.sample);
    } else {
      skipped.push({ row: index, errors: result.errors });
    }
  }

  return { inserted, skipped, duplicateIds: [] };
}
