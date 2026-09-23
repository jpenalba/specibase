import { getSupabase } from "./supabase";
import { EntryStatus } from "./lab-workflow-status";
import { DetailColumnKind } from "./lab-workflows-store";

// Bioinformatic workflow — same table design as lab-workflows-store.ts,
// under its own tables, so a project's Lab and Bioinformatic workflows
// never share rows (see supabase/migrations/0014_bio_workflows.sql). Kept
// as a parallel file rather than parametrizing lab-workflows-store.ts
// itself, since the two domains' data must never mix.

const WORKFLOWS_TABLE = "bio_workflows";
const STEPS_TABLE = "bio_workflow_steps";
const SAMPLES_TABLE = "bio_workflow_samples";
const ENTRIES_TABLE = "bio_workflow_entries";
const CUSTOM_COLUMNS_TABLE = "bio_workflow_custom_columns";
const CUSTOM_VALUES_TABLE = "bio_workflow_custom_values";
const DETAIL_COLUMNS_TABLE = "bio_workflow_detail_columns";
const DETAIL_ROWS_TABLE = "bio_workflow_detail_rows";
const DETAIL_VALUES_TABLE = "bio_workflow_detail_values";

export type BioWorkflowStatus = "in_progress" | "completed";

export type BioWorkflow = {
  id: string;
  project_id: string;
  created_at: string;
  name: string;
  status: BioWorkflowStatus;
};

export type BioWorkflowStep = {
  id: string;
  workflow_id: string;
  created_at: string;
  position: number;
  step_key: string;
  label: string;
};

export type BioWorkflowEntry = {
  id: string;
  step_id: string;
  sample_id: string;
  updated_at: string;
  status: EntryStatus;
  method: string | null;
  date: string | null;
  performed_by: string | null;
  quantification: Record<string, unknown> | null;
  notes: string | null;
};

export async function listBioWorkflowsByProject(projectId: string): Promise<BioWorkflow[]> {
  const { data, error } = await getSupabase()
    .from(WORKFLOWS_TABLE)
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as BioWorkflow[];
}

// Every workflow across every project — used by a project list to show a
// per-project workflow count without an N+1 query.
export async function listAllBioWorkflows(): Promise<BioWorkflow[]> {
  const { data, error } = await getSupabase()
    .from(WORKFLOWS_TABLE)
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as BioWorkflow[];
}

export async function getBioWorkflow(id: string): Promise<BioWorkflow | null> {
  const { data, error } = await getSupabase()
    .from(WORKFLOWS_TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as BioWorkflow | null;
}

export type NewBioStepInput = { step_key: string; label: string };

// Creates the workflow and its initial steps together — a workflow with no
// steps isn't a useful intermediate state, so the dialog that creates one
// always submits both at once. Also seeds the Detailed view's fixed Status
// column (see addBioDetailColumn) — every workflow has one from the start.
export async function createBioWorkflow(
  projectId: string,
  name: string,
  steps: NewBioStepInput[]
): Promise<{ workflow: BioWorkflow; steps: BioWorkflowStep[] }> {
  const { data: workflow, error } = await getSupabase()
    .from(WORKFLOWS_TABLE)
    .insert({ project_id: projectId, name: name.trim() })
    .select()
    .single();
  if (error) throw new Error(error.message);

  const createdSteps = await appendBioSteps(workflow.id, steps);
  const { error: statusColumnError } = await getSupabase()
    .from(DETAIL_COLUMNS_TABLE)
    .insert({ workflow_id: workflow.id, position: 0, label: "Status", kind: "status" });
  if (statusColumnError) throw new Error(statusColumnError.message);
  return { workflow: workflow as BioWorkflow, steps: createdSteps };
}

export type UpdateBioWorkflowInput = { name?: string; status?: BioWorkflowStatus };

export async function updateBioWorkflow(
  id: string,
  input: UpdateBioWorkflowInput
): Promise<BioWorkflow> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.status !== undefined) patch.status = input.status;

  const { data, error } = await getSupabase()
    .from(WORKFLOWS_TABLE)
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as BioWorkflow;
}

// Cascades to its steps, sample enrollments, and entries (see the FKs in
// supabase/migrations/0014_bio_workflows.sql) — no separate cleanup needed.
export async function deleteBioWorkflow(id: string): Promise<void> {
  const { error } = await getSupabase().from(WORKFLOWS_TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listBioSteps(workflowId: string): Promise<BioWorkflowStep[]> {
  const { data, error } = await getSupabase()
    .from(STEPS_TABLE)
    .select("*")
    .eq("workflow_id", workflowId)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as BioWorkflowStep[];
}

// Appends steps after whatever's already there — position is just an
// insertion-order counter, not something a caller assigns directly.
export async function appendBioSteps(
  workflowId: string,
  steps: NewBioStepInput[]
): Promise<BioWorkflowStep[]> {
  if (steps.length === 0) return [];
  const existing = await listBioSteps(workflowId);
  let nextPosition = existing.length;
  const rows = steps.map((step) => ({
    workflow_id: workflowId,
    step_key: step.step_key,
    label: step.label.trim(),
    position: nextPosition++,
  }));
  const { data, error } = await getSupabase().from(STEPS_TABLE).insert(rows).select();
  if (error) throw new Error(error.message);
  return (data ?? []) as BioWorkflowStep[];
}

export async function renameBioStep(id: string, label: string): Promise<BioWorkflowStep> {
  const { data, error } = await getSupabase()
    .from(STEPS_TABLE)
    .update({ label: label.trim() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as BioWorkflowStep;
}

// Applies a full new ordering in one call — the step builder always submits
// the complete list after a drag-reorder, rather than moving one at a time.
export async function reorderBioSteps(workflowId: string, orderedStepIds: string[]): Promise<void> {
  const supabase = getSupabase();
  await Promise.all(
    orderedStepIds.map((stepId, position) =>
      supabase
        .from(STEPS_TABLE)
        .update({ position })
        .eq("id", stepId)
        .eq("workflow_id", workflowId)
    )
  );
}

// Cascades to that step's entries across every sample.
export async function deleteBioStep(id: string): Promise<void> {
  const { error } = await getSupabase().from(STEPS_TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export type BioWorkflowSampleLink = { workflow_id: string; sample_id: string; added_at: string };

export async function listEnrolledBioSamples(workflowId: string): Promise<BioWorkflowSampleLink[]> {
  const { data, error } = await getSupabase()
    .from(SAMPLES_TABLE)
    .select("*")
    .eq("workflow_id", workflowId)
    .order("added_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as BioWorkflowSampleLink[];
}

// A newly enrolled sample starts with no entries at all, which the grid
// and detail views treat as "not started" (grey) for every step — the
// lab ticks each step on as it's actually done, rather than starting
// from a fully-ticked row and unticking what doesn't apply. Also gives it
// its Detailed-view attempt-1 row (see BioWorkflowDetailRow) — further
// attempts only ever come from duplicating a row, never from re-enrolling.
export async function enrollBioSamples(workflowId: string, sampleIds: string[]): Promise<void> {
  if (sampleIds.length === 0) return;
  const rows = sampleIds.map((sampleId) => ({ workflow_id: workflowId, sample_id: sampleId }));
  const { error } = await getSupabase()
    .from(SAMPLES_TABLE)
    .upsert(rows, { onConflict: "workflow_id,sample_id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);

  const { error: rowsError } = await getSupabase()
    .from(DETAIL_ROWS_TABLE)
    .upsert(
      sampleIds.map((sampleId) => ({ workflow_id: workflowId, sample_id: sampleId, attempt_number: 1 })),
      { onConflict: "workflow_id,sample_id,attempt_number", ignoreDuplicates: true }
    );
  if (rowsError) throw new Error(rowsError.message);
}

// Also clears any entries already logged for these samples on this
// workflow's steps, and every Detailed-view row (all attempts, cascading
// to their values) — re-enrolling later starts clean rather than silently
// resurrecting old ticks or redo history the lab thought they'd removed.
export async function unenrollBioSamples(workflowId: string, sampleIds: string[]): Promise<void> {
  if (sampleIds.length === 0) return;
  const supabase = getSupabase();
  const steps = await listBioSteps(workflowId);
  const stepIds = steps.map((s) => s.id);

  if (stepIds.length > 0) {
    const { error: entriesError } = await supabase
      .from(ENTRIES_TABLE)
      .delete()
      .in("step_id", stepIds)
      .in("sample_id", sampleIds);
    if (entriesError) throw new Error(entriesError.message);
  }

  const { error: rowsError } = await supabase
    .from(DETAIL_ROWS_TABLE)
    .delete()
    .eq("workflow_id", workflowId)
    .in("sample_id", sampleIds);
  if (rowsError) throw new Error(rowsError.message);

  const { error } = await supabase
    .from(SAMPLES_TABLE)
    .delete()
    .eq("workflow_id", workflowId)
    .in("sample_id", sampleIds);
  if (error) throw new Error(error.message);
}

// Every entry across every step of this workflow — the grid and detail
// views both fetch the whole workflow's worth at once and slice locally,
// rather than one request per step.
export async function listBioEntriesForWorkflow(workflowId: string): Promise<BioWorkflowEntry[]> {
  const steps = await listBioSteps(workflowId);
  if (steps.length === 0) return [];
  const { data, error } = await getSupabase()
    .from(ENTRIES_TABLE)
    .select("*")
    .in(
      "step_id",
      steps.map((s) => s.id)
    );
  if (error) throw new Error(error.message);
  return (data ?? []) as BioWorkflowEntry[];
}

export type BioEntryUpsertInput = {
  step_id: string;
  sample_id: string;
  status?: EntryStatus;
  method?: string | null;
  date?: string | null;
  performed_by?: string | null;
  quantification?: Record<string, unknown> | null;
  notes?: string | null;
};

// Partial upsert — a row's own keys are the only columns touched, so the
// Simple grid's drag-paint (status only) never clobbers Detailed-view
// fields already logged for that cell, and vice versa.
export async function upsertBioEntries(rows: BioEntryUpsertInput[]): Promise<BioWorkflowEntry[]> {
  if (rows.length === 0) return [];
  // `updated_at` defaults to now() only on insert, not on Postgres's own
  // upsert-as-update path, so it's set explicitly here to stay accurate
  // when a cell that already has a row gets touched again.
  const now = new Date().toISOString();
  const { data, error } = await getSupabase()
    .from(ENTRIES_TABLE)
    .upsert(
      rows.map((row) => ({ ...row, updated_at: now })),
      { onConflict: "step_id,sample_id" }
    )
    .select();
  if (error) throw new Error(error.message);
  return (data ?? []) as BioWorkflowEntry[];
}

export type BioWorkflowCustomColumn = {
  id: string;
  workflow_id: string;
  created_at: string;
  position: number;
  label: string;
};

export type BioWorkflowCustomValue = {
  id: string;
  column_id: string;
  sample_id: string;
  updated_at: string;
  value: string | null;
};

export async function listBioCustomColumns(workflowId: string): Promise<BioWorkflowCustomColumn[]> {
  const { data, error } = await getSupabase()
    .from(CUSTOM_COLUMNS_TABLE)
    .select("*")
    .eq("workflow_id", workflowId)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as BioWorkflowCustomColumn[];
}

// Appended after whatever's already there, same as appendBioSteps — for
// things like a run or library name that don't fit the tick-box status
// model the preset/custom steps use.
export async function addBioCustomColumn(
  workflowId: string,
  label: string
): Promise<BioWorkflowCustomColumn> {
  const existing = await listBioCustomColumns(workflowId);
  const { data, error } = await getSupabase()
    .from(CUSTOM_COLUMNS_TABLE)
    .insert({ workflow_id: workflowId, label: label.trim(), position: existing.length })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as BioWorkflowCustomColumn;
}

export async function renameBioCustomColumn(
  id: string,
  label: string
): Promise<BioWorkflowCustomColumn> {
  const { data, error } = await getSupabase()
    .from(CUSTOM_COLUMNS_TABLE)
    .update({ label: label.trim() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as BioWorkflowCustomColumn;
}

// Cascades to that column's values across every sample.
export async function deleteBioCustomColumn(id: string): Promise<void> {
  const { error } = await getSupabase().from(CUSTOM_COLUMNS_TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// Every custom value across every custom column of this workflow — same
// "fetch the whole workflow's worth at once" approach as
// listBioEntriesForWorkflow.
export async function listBioCustomValuesForWorkflow(
  workflowId: string
): Promise<BioWorkflowCustomValue[]> {
  const columns = await listBioCustomColumns(workflowId);
  if (columns.length === 0) return [];
  const { data, error } = await getSupabase()
    .from(CUSTOM_VALUES_TABLE)
    .select("*")
    .in(
      "column_id",
      columns.map((c) => c.id)
    );
  if (error) throw new Error(error.message);
  return (data ?? []) as BioWorkflowCustomValue[];
}

export type BioCustomValueUpsertInput = { column_id: string; sample_id: string; value: string | null };

export async function upsertBioCustomValues(
  rows: BioCustomValueUpsertInput[]
): Promise<BioWorkflowCustomValue[]> {
  if (rows.length === 0) return [];
  const now = new Date().toISOString();
  const { data, error } = await getSupabase()
    .from(CUSTOM_VALUES_TABLE)
    .upsert(
      rows.map((row) => ({ ...row, updated_at: now })),
      { onConflict: "column_id,sample_id" }
    )
    .select();
  if (error) throw new Error(error.message);
  return (data ?? []) as BioWorkflowCustomValue[];
}

export type BioWorkflowDetailColumn = {
  id: string;
  workflow_id: string;
  created_at: string;
  position: number;
  label: string;
  kind: DetailColumnKind;
};

export type BioWorkflowDetailRow = {
  id: string;
  workflow_id: string;
  sample_id: string;
  created_at: string;
  attempt_number: number;
};

export type BioWorkflowDetailValue = {
  id: string;
  column_id: string;
  row_id: string;
  updated_at: string;
  value: string | null;
};

export async function listBioDetailColumns(workflowId: string): Promise<BioWorkflowDetailColumn[]> {
  const { data, error } = await getSupabase()
    .from(DETAIL_COLUMNS_TABLE)
    .select("*")
    .eq("workflow_id", workflowId)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as BioWorkflowDetailColumn[];
}

// Appended after whatever's already there — the fixed Status column is
// seeded separately (see createBioWorkflow) at position 0 and always sorts
// first, so a user-added column never needs to know about it.
export async function addBioDetailColumn(
  workflowId: string,
  label: string,
  kind: Exclude<DetailColumnKind, "status">
): Promise<BioWorkflowDetailColumn> {
  const existing = await listBioDetailColumns(workflowId);
  const { data, error } = await getSupabase()
    .from(DETAIL_COLUMNS_TABLE)
    .insert({ workflow_id: workflowId, label: label.trim(), kind, position: existing.length })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as BioWorkflowDetailColumn;
}

async function getBioDetailColumn(id: string): Promise<BioWorkflowDetailColumn | null> {
  const { data, error } = await getSupabase()
    .from(DETAIL_COLUMNS_TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as BioWorkflowDetailColumn | null;
}

// The Status column is fixed — seeded once per workflow and never user-
// renamed or removed, so both of these refuse to touch it.
export async function renameBioDetailColumn(
  id: string,
  label: string
): Promise<BioWorkflowDetailColumn> {
  const column = await getBioDetailColumn(id);
  if (column?.kind === "status") throw new Error("The Status column can't be renamed");
  const { data, error } = await getSupabase()
    .from(DETAIL_COLUMNS_TABLE)
    .update({ label: label.trim() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as BioWorkflowDetailColumn;
}

// Cascades to that column's values across every sample.
export async function deleteBioDetailColumn(id: string): Promise<void> {
  const column = await getBioDetailColumn(id);
  if (column?.kind === "status") throw new Error("The Status column can't be deleted");
  const { error } = await getSupabase().from(DETAIL_COLUMNS_TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// Every row (every attempt at every sample) of this workflow's Detailed
// view — the table renders one line per row, grouping by sample_id and
// ordering by attempt_number itself.
export async function listBioDetailRows(workflowId: string): Promise<BioWorkflowDetailRow[]> {
  const { data, error } = await getSupabase()
    .from(DETAIL_ROWS_TABLE)
    .select("*")
    .eq("workflow_id", workflowId)
    .order("attempt_number", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as BioWorkflowDetailRow[];
}

async function getBioDetailRow(id: string): Promise<BioWorkflowDetailRow | null> {
  const { data, error } = await getSupabase()
    .from(DETAIL_ROWS_TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as BioWorkflowDetailRow | null;
}

// "Duplicate row" — a redo of a sample that needs to be run again. Copies
// every value already entered on the source row so the new attempt starts
// as a snapshot of it rather than blank, since most of what changes on a
// redo (Status, a reading) is a small edit on top of what's already there.
export async function duplicateBioDetailRow(
  rowId: string
): Promise<{ row: BioWorkflowDetailRow; values: BioWorkflowDetailValue[] }> {
  const source = await getBioDetailRow(rowId);
  if (!source) throw new Error("Row not found");

  const siblingRows = await getSupabase()
    .from(DETAIL_ROWS_TABLE)
    .select("attempt_number")
    .eq("workflow_id", source.workflow_id)
    .eq("sample_id", source.sample_id);
  if (siblingRows.error) throw new Error(siblingRows.error.message);
  const nextAttempt =
    Math.max(...(siblingRows.data ?? []).map((r) => r.attempt_number as number), 0) + 1;

  const { data: newRow, error: rowError } = await getSupabase()
    .from(DETAIL_ROWS_TABLE)
    .insert({ workflow_id: source.workflow_id, sample_id: source.sample_id, attempt_number: nextAttempt })
    .select()
    .single();
  if (rowError) throw new Error(rowError.message);

  const { data: sourceValues, error: valuesError } = await getSupabase()
    .from(DETAIL_VALUES_TABLE)
    .select("*")
    .eq("row_id", rowId);
  if (valuesError) throw new Error(valuesError.message);

  const copies = (sourceValues ?? []).filter((v) => v.value !== null);
  if (copies.length === 0) {
    return { row: newRow as BioWorkflowDetailRow, values: [] };
  }
  const { data: newValues, error: copyError } = await getSupabase()
    .from(DETAIL_VALUES_TABLE)
    .insert(copies.map((v) => ({ column_id: v.column_id, row_id: newRow.id, value: v.value })))
    .select();
  if (copyError) throw new Error(copyError.message);
  return { row: newRow as BioWorkflowDetailRow, values: (newValues ?? []) as BioWorkflowDetailValue[] };
}

// The attempt-1 row isn't removable here — it's tied to the sample's
// enrollment and goes away only by unenrolling the sample. Only a
// duplicate ("redo") row can be removed this way.
export async function deleteBioDetailRow(id: string): Promise<void> {
  const row = await getBioDetailRow(id);
  if (row?.attempt_number === 1) {
    throw new Error("The original row can't be removed — unenroll the sample instead");
  }
  const { error } = await getSupabase().from(DETAIL_ROWS_TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// Every detail value across every detail column of this workflow — same
// "fetch the whole workflow's worth at once" approach as
// listBioCustomValuesForWorkflow.
export async function listBioDetailValuesForWorkflow(
  workflowId: string
): Promise<BioWorkflowDetailValue[]> {
  const columns = await listBioDetailColumns(workflowId);
  if (columns.length === 0) return [];
  const { data, error } = await getSupabase()
    .from(DETAIL_VALUES_TABLE)
    .select("*")
    .in(
      "column_id",
      columns.map((c) => c.id)
    );
  if (error) throw new Error(error.message);
  return (data ?? []) as BioWorkflowDetailValue[];
}

export type BioDetailValueUpsertInput = { column_id: string; row_id: string; value: string | null };

export async function upsertBioDetailValues(
  rows: BioDetailValueUpsertInput[]
): Promise<BioWorkflowDetailValue[]> {
  if (rows.length === 0) return [];
  const now = new Date().toISOString();
  const { data, error } = await getSupabase()
    .from(DETAIL_VALUES_TABLE)
    .upsert(
      rows.map((row) => ({ ...row, updated_at: now })),
      { onConflict: "column_id,row_id" }
    )
    .select();
  if (error) throw new Error(error.message);
  return (data ?? []) as BioWorkflowDetailValue[];
}
