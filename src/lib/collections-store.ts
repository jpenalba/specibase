import { getSupabase } from "./supabase";
import { RawRow, validateRow } from "./validation";
import { normalizeDatesForStorage } from "./samples-store";
import { CollectionType } from "./collection-types";
import { matchGbifSpeciesBatch, applyGbifClassificationToRow } from "./gbif";

const COLLECTIONS_TABLE = "collections";
const SAMPLES_TABLE = "collection_samples";

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

export async function createCollection(
  input: NewCollectionInput,
  ownerId: string
): Promise<Collection> {
  const name = input.name.trim();
  const { data, error } = await getSupabase()
    .from(COLLECTIONS_TABLE)
    .insert({
      owner_id: ownerId,
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
  return data as Collection;
}

// Partial update — only fields present in `input` are changed.
export async function updateCollection(
  id: string,
  input: UpdateCollectionInput,
  ownerId: string
): Promise<Collection> {
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
    .eq("owner_id", ownerId)
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

export async function listCollections(ownerId: string): Promise<Collection[]> {
  const { data, error } = await getSupabase()
    .from(COLLECTIONS_TABLE)
    .select("*")
    .eq("owner_id", ownerId)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Collection[];
}

export async function getCollection(id: string, ownerId: string): Promise<Collection | null> {
  const { data, error } = await getSupabase()
    .from(COLLECTIONS_TABLE)
    .select("*")
    .eq("id", id)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Collection) ?? null;
}

export type CollectionSampleRef = { id: string; collection_id: string };

// The caller's own collection ids — used to scope collection_samples
// queries below to just this owner's collections, since collection_samples
// itself has no owner_id column (it inherits access through its parent).
async function ownedCollectionIds(ownerId: string): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from(COLLECTIONS_TABLE)
    .select("id")
    .eq("owner_id", ownerId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.id as string);
}

// Just enough to compute a per-collection sample count without an N+1
// query — mirrors listSampleProjectLinks() in @/lib/projects-store.
export async function listCollectionSampleRefs(ownerId: string): Promise<CollectionSampleRef[]> {
  const ids = await ownedCollectionIds(ownerId);
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

export async function listCollectionSamples(collectionId: string): Promise<CollectionSample[]> {
  const { data, error } = await getSupabase()
    .from(SAMPLES_TABLE)
    .select("*")
    .eq("collection_id", collectionId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CollectionSample[];
}

// Every sample across every collection this owner has, each still carrying
// its own collection_id — used by the database map to draw one layer per
// collection without an N+1 fetch per collection.
export async function listAllCollectionSamples(ownerId: string): Promise<CollectionSample[]> {
  const ids = await ownedCollectionIds(ownerId);
  if (ids.length === 0) return [];
  const { data, error } = await getSupabase()
    .from(SAMPLES_TABLE)
    .select("*")
    .in("collection_id", ids)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  return (data ?? []) as CollectionSample[];
}

async function collectionExistingIdentifiers(collectionId: string): Promise<Set<string>> {
  const { data, error } = await getSupabase()
    .from(SAMPLES_TABLE)
    .select("primary_identifier")
    .eq("collection_id", collectionId);
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

  return { ok: true, sample: data as CollectionSample };
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
  if (error) return { ok: false, errors: [error.message] };
  if (!data) return { ok: false, errors: ["Sample not found, or wasn't deleted"] };
  return { ok: true };
}
