import { randomUUID } from "crypto";
import { getSupabase } from "./supabase";
import { ProtocolType, ProtocolSourceType } from "./protocol-types";

const TABLE = "protocols";
const BUCKET = "protocol-files";

export type Protocol = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  description: string | null;
  date_added: string;
  protocol_type: ProtocolType;
  source_type: ProtocolSourceType;
  pdf_url: string | null;
  pdf_filename: string | null;
  content: string | null;
};

export type NewProtocolInput = {
  name: string;
  description?: string;
  date_added?: string;
  protocol_type: ProtocolType;
  source_type: ProtocolSourceType;
  pdf_url?: string;
  pdf_filename?: string;
};

export type UpdateProtocolInput = Partial<NewProtocolInput> & { content?: string };

export async function listProtocols(): Promise<Protocol[]> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("*")
    .order("date_added", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Protocol[];
}

export async function getProtocol(id: string): Promise<Protocol | null> {
  const { data, error } = await getSupabase().from(TABLE).select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Protocol | null;
}

export async function createProtocol(input: NewProtocolInput): Promise<Protocol> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .insert({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      // Omitted (rather than set to null) when blank, so the column's own
      // `default current_date` applies — date_added is NOT NULL.
      date_added: input.date_added?.trim() || undefined,
      protocol_type: input.protocol_type,
      source_type: input.source_type,
      pdf_url: input.pdf_url?.trim() || null,
      pdf_filename: input.pdf_filename?.trim() || null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Protocol;
}

// Partial update — only fields present in `input` are changed. `updated_at`
// is bumped on every call (mirrors lab/bio-workflows-store.ts's pattern —
// there's no DB trigger for it), so it always reflects the most recent
// edit, whether that's a content save or a metadata change from the dialog.
export async function updateProtocol(
  id: string,
  input: UpdateProtocolInput
): Promise<Protocol> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.description !== undefined) patch.description = input.description.trim() || null;
  // date_added is NOT NULL — callers (the API route) validate it's
  // non-blank before this ever runs, so no null fallback here.
  if (input.date_added !== undefined) patch.date_added = input.date_added.trim();
  if (input.protocol_type !== undefined) patch.protocol_type = input.protocol_type;
  if (input.source_type !== undefined) patch.source_type = input.source_type;
  if (input.pdf_url !== undefined) patch.pdf_url = input.pdf_url.trim() || null;
  if (input.pdf_filename !== undefined) patch.pdf_filename = input.pdf_filename.trim() || null;
  if (input.content !== undefined) patch.content = input.content;

  const { data, error } = await getSupabase()
    .from(TABLE)
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Protocol;
}

// Returns the deleted protocol's name so callers (the activity log) can
// name it without a separate lookup.
export async function deleteProtocol(id: string): Promise<string> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .delete()
    .eq("id", id)
    .select("name")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.name as string) ?? id;
}

// Uploads to a public bucket (see supabase/migrations/0021_protocols.sql).
// Not scoped under a protocol id — the file is picked and uploaded before
// the protocol record exists, so the create form uploads first and sends
// the resulting URL along with the rest of the fields in one POST.
export async function uploadProtocolPdf(
  file: File
): Promise<{ url: string; filename: string }> {
  const path = `${randomUUID()}.pdf`;

  const { error } = await getSupabase()
    .storage.from(BUCKET)
    .upload(path, file, { contentType: "application/pdf" });
  if (error) throw new Error(error.message);

  const { data } = getSupabase().storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, filename: file.name };
}

// Images inserted into a built protocol's markdown content — same bucket
// as uploaded PDFs, but under a per-protocol `images/` folder so the two
// never collide (a PDF is `<uuid>.pdf` at the bucket root).
export async function uploadProtocolImage(protocolId: string, file: File): Promise<string> {
  const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "bin";
  const path = `${protocolId}/images/${randomUUID()}.${ext}`;

  const { error } = await getSupabase()
    .storage.from(BUCKET)
    .upload(path, file, { contentType: file.type });
  if (error) throw new Error(error.message);

  const { data } = getSupabase().storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
