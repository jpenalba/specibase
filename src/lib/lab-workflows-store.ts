import { getSupabase } from "./supabase";
import { EntryStatus } from "./lab-workflow-status";

const WORKFLOWS_TABLE = "lab_workflows";
const STEPS_TABLE = "lab_workflow_steps";
const SAMPLES_TABLE = "lab_workflow_samples";
const ENTRIES_TABLE = "lab_workflow_entries";
const CUSTOM_COLUMNS_TABLE = "lab_workflow_custom_columns";
const CUSTOM_VALUES_TABLE = "lab_workflow_custom_values";

export type WorkflowStatus = "in_progress" | "completed";

export type LabWorkflow = {
  id: string;
  project_id: string;
  created_at: string;
  name: string;
  status: WorkflowStatus;
};

export type LabWorkflowStep = {
  id: string;
  workflow_id: string;
  created_at: string;
  position: number;
  step_key: string;
  label: string;
};

export type LabWorkflowEntry = {
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

export async function listWorkflowsByProject(projectId: string): Promise<LabWorkflow[]> {
  const { data, error } = await getSupabase()
    .from(WORKFLOWS_TABLE)
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as LabWorkflow[];
}

// Every workflow across every project — used by the Lab Workflow tab's
// project list to show a per-project workflow count without an N+1 query.
export async function listAllWorkflows(): Promise<LabWorkflow[]> {
  const { data, error } = await getSupabase()
    .from(WORKFLOWS_TABLE)
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as LabWorkflow[];
}

export async function getWorkflow(id: string): Promise<LabWorkflow | null> {
  const { data, error } = await getSupabase()
    .from(WORKFLOWS_TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as LabWorkflow | null;
}

export type NewStepInput = { step_key: string; label: string };

// Creates the workflow and its initial steps together — a workflow with no
// steps isn't a useful intermediate state, so the dialog that creates one
// always submits both at once.
export async function createWorkflow(
  projectId: string,
  name: string,
  steps: NewStepInput[]
): Promise<{ workflow: LabWorkflow; steps: LabWorkflowStep[] }> {
  const { data: workflow, error } = await getSupabase()
    .from(WORKFLOWS_TABLE)
    .insert({ project_id: projectId, name: name.trim() })
    .select()
    .single();
  if (error) throw new Error(error.message);

  const createdSteps = await appendSteps(workflow.id, steps);
  return { workflow: workflow as LabWorkflow, steps: createdSteps };
}

export type UpdateWorkflowInput = { name?: string; status?: WorkflowStatus };

export async function updateWorkflow(
  id: string,
  input: UpdateWorkflowInput
): Promise<LabWorkflow> {
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
  return data as LabWorkflow;
}

// Cascades to its steps, sample enrollments, and entries (see the FKs in
// supabase/migrations/0007_lab_workflows.sql) — no separate cleanup needed.
export async function deleteWorkflow(id: string): Promise<void> {
  const { error } = await getSupabase().from(WORKFLOWS_TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listSteps(workflowId: string): Promise<LabWorkflowStep[]> {
  const { data, error } = await getSupabase()
    .from(STEPS_TABLE)
    .select("*")
    .eq("workflow_id", workflowId)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as LabWorkflowStep[];
}

// Appends steps after whatever's already there — position is just an
// insertion-order counter, not something a caller assigns directly.
export async function appendSteps(
  workflowId: string,
  steps: NewStepInput[]
): Promise<LabWorkflowStep[]> {
  if (steps.length === 0) return [];
  const existing = await listSteps(workflowId);
  let nextPosition = existing.length;
  const rows = steps.map((step) => ({
    workflow_id: workflowId,
    step_key: step.step_key,
    label: step.label.trim(),
    position: nextPosition++,
  }));
  const { data, error } = await getSupabase().from(STEPS_TABLE).insert(rows).select();
  if (error) throw new Error(error.message);
  return (data ?? []) as LabWorkflowStep[];
}

export async function renameStep(id: string, label: string): Promise<LabWorkflowStep> {
  const { data, error } = await getSupabase()
    .from(STEPS_TABLE)
    .update({ label: label.trim() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as LabWorkflowStep;
}

// Applies a full new ordering in one call — the step builder always submits
// the complete list after a drag-reorder, rather than moving one at a time.
export async function reorderSteps(workflowId: string, orderedStepIds: string[]): Promise<void> {
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
export async function deleteStep(id: string): Promise<void> {
  const { error } = await getSupabase().from(STEPS_TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export type WorkflowSampleLink = { workflow_id: string; sample_id: string; added_at: string };

export async function listEnrolledSamples(workflowId: string): Promise<WorkflowSampleLink[]> {
  const { data, error } = await getSupabase()
    .from(SAMPLES_TABLE)
    .select("*")
    .eq("workflow_id", workflowId)
    .order("added_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as WorkflowSampleLink[];
}

// A newly enrolled sample starts with no entries at all, which the grid
// and detail views treat as "not started" (grey) for every step — the
// lab ticks each step on as it's actually done, rather than starting
// from a fully-ticked row and unticking what doesn't apply.
export async function enrollSamples(workflowId: string, sampleIds: string[]): Promise<void> {
  if (sampleIds.length === 0) return;
  const rows = sampleIds.map((sampleId) => ({ workflow_id: workflowId, sample_id: sampleId }));
  const { error } = await getSupabase()
    .from(SAMPLES_TABLE)
    .upsert(rows, { onConflict: "workflow_id,sample_id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

// Also clears any entries already logged for these samples on this
// workflow's steps — re-enrolling later starts clean rather than silently
// resurrecting old ticks the lab thought they'd removed.
export async function unenrollSamples(workflowId: string, sampleIds: string[]): Promise<void> {
  if (sampleIds.length === 0) return;
  const supabase = getSupabase();
  const steps = await listSteps(workflowId);
  const stepIds = steps.map((s) => s.id);

  if (stepIds.length > 0) {
    const { error: entriesError } = await supabase
      .from(ENTRIES_TABLE)
      .delete()
      .in("step_id", stepIds)
      .in("sample_id", sampleIds);
    if (entriesError) throw new Error(entriesError.message);
  }

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
export async function listEntriesForWorkflow(workflowId: string): Promise<LabWorkflowEntry[]> {
  const steps = await listSteps(workflowId);
  if (steps.length === 0) return [];
  const { data, error } = await getSupabase()
    .from(ENTRIES_TABLE)
    .select("*")
    .in(
      "step_id",
      steps.map((s) => s.id)
    );
  if (error) throw new Error(error.message);
  return (data ?? []) as LabWorkflowEntry[];
}

export type EntryUpsertInput = {
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
export async function upsertEntries(rows: EntryUpsertInput[]): Promise<LabWorkflowEntry[]> {
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
  return (data ?? []) as LabWorkflowEntry[];
}

export type LabWorkflowCustomColumn = {
  id: string;
  workflow_id: string;
  created_at: string;
  position: number;
  label: string;
};

export type LabWorkflowCustomValue = {
  id: string;
  column_id: string;
  sample_id: string;
  updated_at: string;
  value: string | null;
};

export async function listCustomColumns(workflowId: string): Promise<LabWorkflowCustomColumn[]> {
  const { data, error } = await getSupabase()
    .from(CUSTOM_COLUMNS_TABLE)
    .select("*")
    .eq("workflow_id", workflowId)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as LabWorkflowCustomColumn[];
}

// Appended after whatever's already there, same as appendSteps — for
// things like an extraction or library name that don't fit the tick-box
// status model the preset/custom steps use.
export async function addCustomColumn(
  workflowId: string,
  label: string
): Promise<LabWorkflowCustomColumn> {
  const existing = await listCustomColumns(workflowId);
  const { data, error } = await getSupabase()
    .from(CUSTOM_COLUMNS_TABLE)
    .insert({ workflow_id: workflowId, label: label.trim(), position: existing.length })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as LabWorkflowCustomColumn;
}

export async function renameCustomColumn(
  id: string,
  label: string
): Promise<LabWorkflowCustomColumn> {
  const { data, error } = await getSupabase()
    .from(CUSTOM_COLUMNS_TABLE)
    .update({ label: label.trim() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as LabWorkflowCustomColumn;
}

// Cascades to that column's values across every sample.
export async function deleteCustomColumn(id: string): Promise<void> {
  const { error } = await getSupabase().from(CUSTOM_COLUMNS_TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// Every custom value across every custom column of this workflow — same
// "fetch the whole workflow's worth at once" approach as
// listEntriesForWorkflow.
export async function listCustomValuesForWorkflow(
  workflowId: string
): Promise<LabWorkflowCustomValue[]> {
  const columns = await listCustomColumns(workflowId);
  if (columns.length === 0) return [];
  const { data, error } = await getSupabase()
    .from(CUSTOM_VALUES_TABLE)
    .select("*")
    .in(
      "column_id",
      columns.map((c) => c.id)
    );
  if (error) throw new Error(error.message);
  return (data ?? []) as LabWorkflowCustomValue[];
}

export type CustomValueUpsertInput = { column_id: string; sample_id: string; value: string | null };

export async function upsertCustomValues(
  rows: CustomValueUpsertInput[]
): Promise<LabWorkflowCustomValue[]> {
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
  return (data ?? []) as LabWorkflowCustomValue[];
}
