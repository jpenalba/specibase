import { getSupabase } from "./supabase";
import { customColumnIdFromKey, customColumnKey } from "./sample-custom-columns-store";

const COLUMNS_TABLE = "collection_custom_columns";
const VALUES_TABLE = "collection_custom_values";

// The collection equivalent of SampleCustomColumn (sample-custom-columns-
// store.ts) — always scoped to one collection, since collection_samples
// has no account-wide "plain Database page" view for a column to default
// to the way a sample custom column can. Reuses that module's
// customColumnKey/customColumnIdFromKey (the "custom:<id>" key format is
// generic — collections-store.ts never mixes the two id spaces, so the
// same prefix is safe to share rather than duplicate).
export type CollectionCustomColumn = {
  id: string;
  created_at: string;
  collection_id: string;
  position: number;
  label: string;
};

export type CollectionCustomValue = {
  id: string;
  column_id: string;
  sample_id: string;
  updated_at: string;
  value: string | null;
};

export { customColumnKey, customColumnIdFromKey };

export async function listCollectionCustomColumns(
  collectionId: string
): Promise<CollectionCustomColumn[]> {
  const { data, error } = await getSupabase()
    .from(COLUMNS_TABLE)
    .select("*")
    .eq("collection_id", collectionId)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as CollectionCustomColumn[];
}

export async function addCollectionCustomColumn(
  collectionId: string,
  label: string
): Promise<CollectionCustomColumn> {
  const existing = await listCollectionCustomColumns(collectionId);
  const { data, error } = await getSupabase()
    .from(COLUMNS_TABLE)
    .insert({ collection_id: collectionId, label: label.trim(), position: existing.length })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as CollectionCustomColumn;
}

export async function renameCollectionCustomColumn(
  id: string,
  label: string,
  collectionId: string
): Promise<CollectionCustomColumn> {
  const { data, error } = await getSupabase()
    .from(COLUMNS_TABLE)
    .update({ label: label.trim() })
    .eq("id", id)
    .eq("collection_id", collectionId)
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Custom column not found");
  return data as CollectionCustomColumn;
}

// Cascades to that column's values across every sample in the collection.
export async function deleteCollectionCustomColumn(id: string, collectionId: string): Promise<void> {
  const { error } = await getSupabase()
    .from(COLUMNS_TABLE)
    .delete()
    .eq("id", id)
    .eq("collection_id", collectionId);
  if (error) throw new Error(error.message);
}

// Every custom value across this one collection's samples — scoped by
// going through its own columns' ids rather than a direct collection_id
// column on the values table, since a value only ever points at a
// column, same relationship sample_custom_values has to sample_custom_
// columns.
export async function listCollectionCustomValues(collectionId: string): Promise<CollectionCustomValue[]> {
  const columns = await listCollectionCustomColumns(collectionId);
  if (columns.length === 0) return [];
  const { data, error } = await getSupabase()
    .from(VALUES_TABLE)
    .select("*")
    .in("column_id", columns.map((c) => c.id));
  if (error) throw new Error(error.message);
  return (data ?? []) as CollectionCustomValue[];
}

export type CollectionCustomValueUpsertInput = {
  column_id: string;
  sample_id: string;
  value: string | null;
};

export async function upsertCollectionCustomValues(
  rows: CollectionCustomValueUpsertInput[]
): Promise<CollectionCustomValue[]> {
  if (rows.length === 0) return [];
  const now = new Date().toISOString();
  const { data, error } = await getSupabase()
    .from(VALUES_TABLE)
    .upsert(
      rows.map((row) => ({ ...row, updated_at: now })),
      { onConflict: "column_id,sample_id" }
    )
    .select();
  if (error) throw new Error(error.message);
  return (data ?? []) as CollectionCustomValue[];
}
