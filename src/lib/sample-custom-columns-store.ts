import { getSupabase } from "./supabase";
import { FieldDef } from "./fields";

const COLUMNS_TABLE = "sample_custom_columns";
const VALUES_TABLE = "sample_custom_values";

// The key prefix used to smuggle a custom column's value through the same
// RawRow/FieldDef machinery every preset field already uses (add/edit
// dialogs, the table's generic column loop, CSV export, marker style) —
// samples-store.ts strips/reattaches these before touching the `samples`
// table itself, since they're not real columns there.
const KEY_PREFIX = "custom:";

export type SampleCustomColumn = {
  id: string;
  created_at: string;
  position: number;
  label: string;
};

export type SampleCustomValue = {
  id: string;
  column_id: string;
  sample_id: string;
  updated_at: string;
  value: string | null;
};

export function customColumnKey(columnId: string): string {
  return `${KEY_PREFIX}${columnId}`;
}

export function customColumnIdFromKey(key: string): string | null {
  return key.startsWith(KEY_PREFIX) ? key.slice(KEY_PREFIX.length) : null;
}

// A runtime FieldDef for a custom column — always "text", since unlike a
// preset field there's no fixed vocabulary to type-check against, which is
// the whole point of an "Other: specify" field.
export function customColumnToFieldDef(column: SampleCustomColumn): FieldDef {
  return { key: customColumnKey(column.id), label: column.label, type: "text" };
}

export async function listCustomColumns(): Promise<SampleCustomColumn[]> {
  const { data, error } = await getSupabase()
    .from(COLUMNS_TABLE)
    .select("*")
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as SampleCustomColumn[];
}

// Appended after whatever's already there, same as the lab/bio workflows'
// own custom columns.
export async function addCustomColumn(label: string): Promise<SampleCustomColumn> {
  const existing = await listCustomColumns();
  const { data, error } = await getSupabase()
    .from(COLUMNS_TABLE)
    .insert({ label: label.trim(), position: existing.length })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as SampleCustomColumn;
}

export async function renameCustomColumn(id: string, label: string): Promise<SampleCustomColumn> {
  const { data, error } = await getSupabase()
    .from(COLUMNS_TABLE)
    .update({ label: label.trim() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as SampleCustomColumn;
}

// Cascades to that column's values across every sample.
export async function deleteCustomColumn(id: string): Promise<void> {
  const { error } = await getSupabase().from(COLUMNS_TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// Every custom value across every sample in the database — attached onto
// each SampleRecord by readSamples() so the table, dialogs, CSV export, and
// marker style can all read it via plain `sample[key]`, same as any preset
// field.
export async function listAllCustomValues(): Promise<SampleCustomValue[]> {
  const { data, error } = await getSupabase().from(VALUES_TABLE).select("*");
  if (error) throw new Error(error.message);
  return (data ?? []) as SampleCustomValue[];
}

export type CustomValueUpsertInput = { column_id: string; sample_id: string; value: string | null };

export async function upsertCustomValues(
  rows: CustomValueUpsertInput[]
): Promise<SampleCustomValue[]> {
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
  return (data ?? []) as SampleCustomValue[];
}
