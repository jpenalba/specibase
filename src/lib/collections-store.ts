import { getSupabase } from "./supabase";
import { RawRow, validateRow } from "./validation";
import { normalizeDatesForStorage } from "./samples-store";
import { CollectionType } from "./collection-types";
import { matchGbifSpeciesBatch, applyGbifClassificationToRow } from "./gbif";
import { addMember } from "./collection-members-store";
import {
  customColumnIdFromKey,
  customColumnKey,
  listCollectionCustomValues,
  upsertCollectionCustomValues,
} from "./collection-custom-columns-store";

const COLLECTIONS_TABLE = "collections";
const SAMPLES_TABLE = "collection_samples";
const MEMBERS_TABLE = "collection_members";

// Postgres's unique_violation code — used to turn a duplicate name into a
// message worth showing someone, instead of a raw constraint error.
const UNIQUE_VIOLATION = "23505";

export type Collection = {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
  description: string | null;
  date_added: string;
  focal_group: string | null;
  location: string | null;
  // Free-text, comma-separated — see parseCollaborators() in
  // @/lib/collaborators for turning this into a list for display.
  contacts: string | null;
  // Groups this collection into a folder on the database map's layer
  // panel — see src/lib/collection-types.ts.
  collection_type: CollectionType;
};

export type NewCollectionInput = {
  name: string;
  description?: string;
  date_added?: string;
  focal_group?: string;
  location?: string;
  contacts?: string;
  collection_type?: CollectionType;
};

export type UpdateCollectionInput = Partial<NewCollectionInput>;

// Creating a collection makes `creatorId` its first Owner, same as
// createProject does for project_members.
export async function createCollection(
  input: NewCollectionInput,
  creatorId: string
): Promise<Collection> {
  const name = input.name.trim();
  const { data, error } = await getSupabase()
    .from(COLLECTIONS_TABLE)
    .insert({
      owner_id: creatorId,
      name,
      description: input.description?.trim() || null,
      // Omitted (rather than set to null) when blank, so the column's own
      // `default current_date` applies — date_added is NOT NULL.
      date_added: input.date_added?.trim() || undefined,
      focal_group: input.focal_group?.trim() || null,
      location: input.location?.trim() || null,
      contacts: input.contacts?.trim() || null,
      collection_type: input.collection_type ?? "other",
    })
    .select()
    .single();
  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      throw new Error(`A collection named "${name}" already exists.`);
    }
    throw new Error(error.message);
  }
  const collection = data as Collection;
  await addMember(collection.id, creatorId, "owner");
  return collection;
}

// Partial update — only fields present in `input` are changed. No owner_id
// filter here any more: the caller (the API route) has already checked
// requireCollectionRole before this runs, same division of labor as
// updateProject.
export async function updateCollection(id: string, input: UpdateCollectionInput): Promise<Collection> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.description !== undefined) patch.description = input.description.trim() || null;
  // date_added is NOT NULL — callers (the API route) validate it's
  // non-blank before this ever runs, so no null fallback here.
  if (input.date_added !== undefined) patch.date_added = input.date_added.trim();
  if (input.focal_group !== undefined) patch.focal_group = input.focal_group.trim() || null;
  if (input.location !== undefined) patch.location = input.location.trim() || null;
  if (input.contacts !== undefined) patch.contacts = input.contacts.trim() || null;
  if (input.collection_type !== undefined) patch.collection_type = input.collection_type;

  const { data, error } = await getSupabase()
    .from(COLLECTIONS_TABLE)
    .update(patch)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      throw new Error(`A collection named "${patch.name}" already exists.`);
    }
    throw new Error(error.message);
  }
  if (!data) throw new Error("Collection not found");
  return data as Collection;
}

// Every collection `userId` is a member of, regardless of role — replaces
// the old owner_id-only listing now that a collection can be shared (see
// supabase/migrations/0044_collection_members.sql). Mirrors
// listProjectsForUser in @/lib/projects-store.
export async function listCollections(userId: string): Promise<Collection[]> {
  const { data, error } = await getSupabase()
    .from(MEMBERS_TABLE)
    .select("collections(*)")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const collections = (data ?? []).map((row) => row.collections as unknown as Collection);
  collections.sort((a, b) => a.name.localeCompare(b.name));
  return collections;
}

// No ownerId/userId param any more — the caller (every /api/collections/
// [id]/** route) checks requireCollectionRole first, so this is just a
// plain lookup by id, same division of labor as how project routes fetch
// a project after requireProjectRole rather than re-filtering by member.
export async function getCollection(id: string): Promise<Collection | null> {
  const { data, error } = await getSupabase()
    .from(COLLECTIONS_TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Collection) ?? null;
}

export type CollectionSampleRef = { id: string; collection_id: string };

// Every collection `userId` is a member of — used to scope
// collection_samples queries below, since collection_samples itself has no
// member table of its own (it inherits access through its parent). Mirrors
// listCollections' own membership query, just the ids.
async function memberCollectionIds(userId: string): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from(MEMBERS_TABLE)
    .select("collection_id")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.collection_id as string);
}

// Just enough to compute a per-collection sample count without an N+1
// query — mirrors listSampleProjectLinks() in @/lib/projects-store.
export async function listCollectionSampleRefs(userId: string): Promise<CollectionSampleRef[]> {
  const ids = await memberCollectionIds(userId);
  if (ids.length === 0) return [];
  const { data, error } = await getSupabase()
    .from(SAMPLES_TABLE)
    .select("id, collection_id")
    .in("collection_id", ids);
  if (error) throw new Error(error.message);
  return (data ?? []) as CollectionSampleRef[];
}

export type CollectionSample = {
  id: string;
  collection_id: string;
  created_at: string;
  primary_identifier: string;
  species: string;
  latitude?: number;
  longitude?: number;
  [optionalField: string]: string | number | undefined;
};

// Merges "Other: specify" custom field values onto their sample under
// `custom:<column id>` — see collection-custom-columns-store.ts — same
// convention samples-store.ts's own attachCustomValues uses, so the
// table, CSV export, etc. can all read one via plain `sample[key]`, same
// as any preset field.
function attachCustomValues(
  samples: CollectionSample[],
  values: { column_id: string; sample_id: string; value: string | null }[]
): CollectionSample[] {
  if (values.length === 0) return samples;
  const bySampleId = new Map<string, { column_id: string; value: string | null }[]>();
  for (const v of values) {
    const list = bySampleId.get(v.sample_id) ?? [];
    list.push(v);
    bySampleId.set(v.sample_id, list);
  }
  for (const sample of samples) {
    for (const v of bySampleId.get(sample.id) ?? []) {
      if (v.value !== null) sample[customColumnKey(v.column_id)] = v.value;
    }
  }
  return samples;
}

export async function listCollectionSamples(collectionId: string): Promise<CollectionSample[]> {
  const { data, error } = await getSupabase()
    .from(SAMPLES_TABLE)
    .select("*")
    .eq("collection_id", collectionId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const samples = (data ?? []) as CollectionSample[];
  return attachCustomValues(samples, await listCollectionCustomValues(collectionId));
}

// Every sample across every collection this user is a member of, each
// still carrying its own collection_id — used by the database map to draw
// one layer per collection without an N+1 fetch per collection.
export async function listAllCollectionSamples(userId: string): Promise<CollectionSample[]> {
  const ids = await memberCollectionIds(userId);
  if (ids.length === 0) return [];
  const { data, error } = await getSupabase()
    .from(SAMPLES_TABLE)
    .select("*")
    .in("collection_id", ids)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  return (data ?? []) as CollectionSample[];
}

// Filtered by deleted_at so a deleted sample's ID is free to reuse right
// away — matches the database's own partial unique index (see
// supabase/migrations/0042_samples_cleanup.sql).
async function collectionExistingIdentifiers(collectionId: string): Promise<Set<string>> {
  const { data, error } = await getSupabase()
    .from(SAMPLES_TABLE)
    .select("primary_identifier")
    .eq("collection_id", collectionId)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => row.primary_identifier as string));
}

export type CollectionInsertResult =
  | { ok: true; sample: CollectionSample }
  | { ok: false; errors: string[] };

// Sample IDs only need to be unique within this one collection (see the
// migration) — validateRow is still reused as-is, just against a
// collection-scoped set of existing identifiers instead of the main
// database's global one.
export async function insertCollectionSample(
  collectionId: string,
  row: RawRow
): Promise<CollectionInsertResult> {
  const existingIds = await collectionExistingIdentifiers(collectionId);
  const { errors } = validateRow(row, existingIds);
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const { primary_identifier, species, latitude, longitude, ...rest } = row;
  // "custom:<column id>" keys aren't real columns on `collection_samples`
  // — pull them out before building the insert payload and write them to
  // collection_custom_values separately once the sample itself exists,
  // same as insertSample does for the main samples table.
  const customEntries = Object.entries(rest).filter(([key]) => customColumnIdFromKey(key) !== null);
  for (const [key] of customEntries) delete rest[key];

  const insertValues: Record<string, string | number> = {
    collection_id: collectionId,
    primary_identifier: primary_identifier.trim(),
    species: species.trim(),
    ...normalizeDatesForStorage(rest),
  };
  if (latitude?.trim()) insertValues.latitude = Number(latitude);
  if (longitude?.trim()) insertValues.longitude = Number(longitude);

  const { data, error } = await getSupabase()
    .from(SAMPLES_TABLE)
    .insert(insertValues)
    .select()
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return {
        ok: false,
        errors: [`Sample ID "${primary_identifier.trim()}" already exists in this collection`],
      };
    }
    return { ok: false, errors: [error.message] };
  }

  const sample = data as CollectionSample;
  if (customEntries.length > 0) {
    const upserted = await upsertCollectionCustomValues(
      customEntries.map(([key, value]) => ({
        column_id: customColumnIdFromKey(key)!,
        sample_id: sample.id,
        value: value?.trim() ? value.trim() : null,
      }))
    );
    for (const v of upserted) {
      if (v.value !== null) sample[customColumnKey(v.column_id)] = v.value;
    }
  }

  return { ok: true, sample };
}

export type CollectionBulkImportResult = {
  inserted: CollectionSample[];
  skipped: { row: number; errors: string[] }[];
  duplicateIds: string[];
};

export async function insertCollectionSamplesBulk(
  collectionId: string,
  rows: RawRow[]
): Promise<CollectionBulkImportResult> {
  const seen = await collectionExistingIdentifiers(collectionId);
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

  const inserted: CollectionSample[] = [];
  const skipped: { row: number; errors: string[] }[] = [];

  for (const [index, row] of rows.entries()) {
    const result = await insertCollectionSample(
      collectionId,
      applyGbifClassificationToRow(row, taxonomyByName)
    );
    if (result.ok) {
      inserted.push(result.sample);
    } else {
      skipped.push({ row: index, errors: result.errors });
    }
  }

  return { inserted, skipped, duplicateIds: [] };
}

// Soft-delete, same reasoning as samples-store.ts's deleteSample — reversible
// via restoreCollectionSample, and only affects a currently-live row.
export async function deleteCollectionSample(
  collectionId: string,
  sampleId: string
): Promise<
  { ok: true; primaryIdentifier: string } | { ok: false; errors: string[] }
> {
  const { data, error } = await getSupabase()
    .from(SAMPLES_TABLE)
    .update({ deleted_at: new Date().toISOString() })
    .eq("collection_id", collectionId)
    .eq("id", sampleId)
    .is("deleted_at", null)
    .select("primary_identifier")
    .maybeSingle();
  if (error) return { ok: false, errors: [error.message] };
  if (!data) return { ok: false, errors: ["Sample not found"] };
  return { ok: true, primaryIdentifier: data.primary_identifier as string };
}

export async function restoreCollectionSample(
  collectionId: string,
  sampleId: string
): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  const { data, error } = await getSupabase()
    .from(SAMPLES_TABLE)
    .update({ deleted_at: null })
    .eq("collection_id", collectionId)
    .eq("id", sampleId)
    .not("deleted_at", "is", null)
    .select("id")
    .maybeSingle();
  if (error) {
    // See restoreSample in samples-store.ts for why this can happen now.
    if (error.code === "23505") {
      return {
        ok: false,
        errors: ["Can't restore — a sample with this ID already exists. Rename or delete that one first."],
      };
    }
    return { ok: false, errors: [error.message] };
  }
  if (!data) return { ok: false, errors: ["Sample not found, or wasn't deleted"] };
  return { ok: true };
}
