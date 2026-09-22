"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LabWorkflow, LabWorkflowEntry, LabWorkflowStep } from "@/lib/lab-workflows-store";
import { SampleRecord } from "@/lib/samples-store";
import { EntryStatus } from "@/lib/lab-workflow-status";
import { WorkflowStatusBadge } from "@/components/lab-workflow/workflow-status-badge";
import { ManageSamplesDialog } from "@/components/lab-workflow/manage-samples-dialog";
import { StepManagerDialog } from "@/components/lab-workflow/step-manager-dialog";
import { SimpleGrid } from "@/components/lab-workflow/simple-grid";
import { DetailedView, DetailedEntryPatch } from "@/components/lab-workflow/detailed-view";
import { Button } from "@/components/ui/button";
import { cn, compareIdentifiers } from "@/lib/utils";

type ViewMode = "simple" | "detailed";

function mergeEntry(
  entries: LabWorkflowEntry[],
  stepId: string,
  sampleId: string,
  patch: Partial<Omit<LabWorkflowEntry, "id" | "step_id" | "sample_id">>
): LabWorkflowEntry[] {
  const index = entries.findIndex((e) => e.step_id === stepId && e.sample_id === sampleId);
  if (index === -1) {
    const created: LabWorkflowEntry = {
      id: `pending-${stepId}-${sampleId}`,
      step_id: stepId,
      sample_id: sampleId,
      updated_at: new Date().toISOString(),
      status: "not_started",
      method: null,
      date: null,
      performed_by: null,
      quantification: null,
      notes: null,
      ...patch,
    };
    return [...entries, created];
  }
  const next = entries.slice();
  next[index] = { ...next[index], ...patch };
  return next;
}

export default function WorkflowGridPage() {
  const { id: projectId, workflowId } = useParams<{ id: string; workflowId: string }>();

  const [workflow, setWorkflow] = useState<LabWorkflow | null>(null);
  const [steps, setSteps] = useState<LabWorkflowStep[]>([]);
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());
  const [entries, setEntries] = useState<LabWorkflowEntry[]>([]);
  const [allSamples, setAllSamples] = useState<SampleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("simple");

  const load = useCallback(() => {
    Promise.all([
      fetch(`/api/lab-workflows/${workflowId}`).then((res) => res.json()),
      fetch("/api/samples").then((res) => res.json()),
    ])
      .then(([detail, samplesData]) => {
        if (detail.errors?.length > 0) {
          setError(detail.errors.join(" "));
          return;
        }
        setError(null);
        setWorkflow(detail.workflow);
        setSteps(detail.steps ?? []);
        setEnrolledIds(new Set(detail.sampleIds ?? []));
        setEntries(detail.entries ?? []);
        setAllSamples(samplesData.samples ?? []);
      })
      .catch(() => setError("Couldn't reach the server."))
      .finally(() => setLoading(false));
  }, [workflowId]);

  useEffect(() => {
    load();
  }, [load]);

  const enrolledSamples = useMemo(
    () =>
      allSamples
        .filter((s) => enrolledIds.has(s.id))
        .sort((a, b) => compareIdentifiers(a.primary_identifier, b.primary_identifier)),
    [allSamples, enrolledIds]
  );

  const entryCountByStepId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      counts.set(entry.step_id, (counts.get(entry.step_id) ?? 0) + 1);
    }
    return counts;
  }, [entries]);

  function handleGridCommit(cells: { step_id: string; sample_id: string; status: EntryStatus }[]) {
    setEntries((prev) => {
      let next = prev;
      for (const cell of cells) {
        next = mergeEntry(next, cell.step_id, cell.sample_id, { status: cell.status });
      }
      return next;
    });
    fetch(`/api/lab-workflows/${workflowId}/entries`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: cells }),
    }).catch(() => setError("Couldn't save one or more changes — try again."));
  }

  function handleDetailedSave(stepId: string, sampleId: string, patch: DetailedEntryPatch) {
    setEntries((prev) => mergeEntry(prev, stepId, sampleId, patch));
    fetch(`/api/lab-workflows/${workflowId}/entries`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: [{ step_id: stepId, sample_id: sampleId, ...patch }] }),
    }).catch(() => setError("Couldn't save that change — try again."));
  }

  if (loading) {
    return <p className="mx-auto max-w-6xl text-sm text-muted-foreground">Loading...</p>;
  }

  if (error || !workflow) {
    return (
      <div className="mx-auto max-w-6xl">
        <Link
          href={`/projects/${projectId}/lab-workflow`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="size-4" /> Back to workflows
        </Link>
        <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error ?? "Workflow not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[100rem] flex-col gap-6">
      <Link
        href={`/projects/${projectId}/lab-workflow`}
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-4" /> Back to workflows
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{workflow.name}</h1>
            <WorkflowStatusBadge status={workflow.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {enrolledSamples.length} sample{enrolledSamples.length === 1 ? "" : "s"} ·{" "}
            {steps.length} step{steps.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ManageSamplesDialog
            workflowId={workflowId}
            allSamples={allSamples}
            enrolledIds={enrolledIds}
            onSaved={load}
            trigger={<Button variant="outline">Manage samples</Button>}
          />
          <StepManagerDialog
            workflowId={workflowId}
            steps={steps}
            entryCountByStepId={entryCountByStepId}
            onSaved={load}
            trigger={<Button variant="outline">Edit steps</Button>}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex w-fit overflow-hidden rounded-md border border-input">
        {(["simple", "detailed"] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setView(mode)}
            className={cn(
              "px-3 py-1.5 text-sm capitalize",
              view === mode ? "bg-primary text-primary-foreground" : "hover:bg-accent"
            )}
          >
            {mode}
          </button>
        ))}
      </div>

      {view === "simple" ? (
        <SimpleGrid
          steps={steps}
          samples={enrolledSamples}
          entries={entries}
          onCommit={handleGridCommit}
        />
      ) : (
        <DetailedView
          steps={steps}
          samples={enrolledSamples}
          entries={entries}
          onSaveEntry={handleDetailedSave}
        />
      )}
    </div>
  );
}
