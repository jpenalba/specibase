import { getSupabase } from "./supabase";
import { CitationMetadata } from "./citation-metadata";
import { firstAuthorSortKey, formatApaCitation } from "./apa-format";

const TABLE = "project_references";

export type ProjectReference = {
  id: string;
  project_id: string;
  created_at: string;
  citation: string;
  sort_key: string;
  doi: string | null;
  source: CitationMetadata | null;
};

export async function listReferences(projectId: string): Promise<ProjectReference[]> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("*")
    .eq("project_id", projectId)
    .order("sort_key", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ProjectReference[];
}

// A reference found via Crossref search — the citation is formatted here
// (not trusted from the client) so it's always consistent with
// apa-format.ts regardless of what the search endpoint returned.
export async function addReferenceFromMetadata(
  projectId: string,
  metadata: CitationMetadata
): Promise<ProjectReference> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .insert({
      project_id: projectId,
      citation: formatApaCitation(metadata),
      sort_key: firstAuthorSortKey(metadata),
      doi: metadata.doi,
      source: metadata,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ProjectReference;
}

// A hand-pasted citation — stored exactly as typed, with no structured
// author data to sort by, so the sort key is just the citation's own
// leading text (still gives a reasonable alphabetical position, since
// APA citations themselves start with the author's surname).
export async function addManualReference(
  projectId: string,
  citation: string
): Promise<ProjectReference> {
  const trimmed = citation.trim();
  const { data, error } = await getSupabase()
    .from(TABLE)
    .insert({
      project_id: projectId,
      citation: trimmed,
      sort_key: trimmed.slice(0, 200).toLowerCase(),
      doi: null,
      source: null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ProjectReference;
}

// Editing a reference (Crossref-sourced or manual) always turns it into a
// plain hand-edited one going forward — re-deriving the sort key from the
// new text rather than keeping a stale author-based key, and dropping the
// doi/source link rather than leaving them describing text that's since
// been changed.
export async function updateReference(
  id: string,
  citation: string
): Promise<ProjectReference> {
  const trimmed = citation.trim();
  const { data, error } = await getSupabase()
    .from(TABLE)
    .update({
      citation: trimmed,
      sort_key: trimmed.slice(0, 200).toLowerCase(),
      doi: null,
      source: null,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ProjectReference;
}

export async function deleteReference(id: string): Promise<void> {
  const { error } = await getSupabase().from(TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}
