"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { LabWorkflow, LabWorkflowEntry, LabWorkflowStep } from "@/lib/lab-workflows-store";
import { SampleRecord } from "@/lib/samples-store";
import { EntryStatus } from "@/lib/lab-workflow-status";
import { WorkflowStatusBadge } from "./workflow-status-badge";
import { WorkflowDialog } from "./workflow-dialog";
import { ManageSamplesDialog } from "./manage-samples-dialog";
import { StepManagerDialog } from "./step-manager-dialog";
import { SimpleGrid } from "./simple-grid";
import { DetailedView, DetailedEntryPatch } from "./detailed-view";
import { Button } from "@/components/ui/button";
import { cn, compareIdentifiers } from "@/lib/utils";

type ViewMode = "simple" | "detailed";
const PAGE_SIZES = [20, 50, 100] as const;

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

// One workflow's full grid, as its own self-contained section — the Lab
// workflow tab renders one of these per workflow, stacked, rather than
// each workflow living on its own page.
export function WorkflowSection({
  projectId,
  workflowId,
  allSamples,
  onDeleted,
}: {
  projectId: string;
  workflowId: string;
  allSamples: SampleRecord[];
  // Called after this workflow is deleted (from its Edit dialog) so the
  // page can drop this section from the stacked list.
  onDeleted: () => void;
}) {
  const [workflow, setWorkflow] = useState<LabWorkflow | null>(null);
  const [steps, setSteps] = useState<LabWorkflowStep[]>([]);
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());
  const [entries, setEntries] = useState<LabWorkflowEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("simple");
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const [page, setPage] = useState(0);

  const load = useCallback(() => {
    fetch(`/api/lab-workflows/${workflowId}`)
      .then((res) => res.json())
      .then((detail) => {
        if (detail.errors?.length > 0) {
          setError(detail.errors.join(" "));
          return;
        }
        setError(null);
        setWorkflow(detail.workflow);
        setSteps(detail.steps ?? []);
        setEnrolledIds(new Set(detail.sampleIds ?? []));
        setEntries(detail.entries ?? []);
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

  // Applies to both the Simple grid and the Detailed view below — a
  // workflow with many enrolled samples shouldn't render them all at
  // once, and toggling between the two views keeps the same page.
  const totalPages = Math.max(1, Math.ceil(enrolledSamples.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pageSamples = enrolledSamples.slice(
    currentPage * pageSize,
    currentPage * pageSize + pageSize
  );
  const rangeStart = enrolledSamples.length === 0 ? 0 : currentPage * pageSize + 1;
  const rangeEnd = Math.min(enrolledSamples.length, currentPage * pageSize + pageSize);

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
    return (
      <div className="rounded-lg border border-border p-6 text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
        {error ?? "Workflow not found."}
      </div>
    );
  }

  return (
    <div className="grid gap-4 rounded-lg border border-border p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">{workflow.name}</h2>
            <WorkflowStatusBadge status={workflow.status} />
            <WorkflowDialog
              projectId={projectId}
              workflow={workflow}
              onSaved={load}
              onDeleted={onDeleted}
              trigger={
                <button
                  type="button"
                  className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  aria-label={`Edit ${workflow.name}`}
                >
                  <Pencil className="size-4" />
                </button>
              }
            />
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
            trigger={<Button variant="outline" size="sm">Manage samples</Button>}
          />
          <StepManagerDialog
            workflowId={workflowId}
            steps={steps}
            entryCountByStepId={entryCountByStepId}
            onSaved={load}
            trigger={<Button variant="outline" size="sm">Edit steps</Button>}
          />
        </div>
      </div>

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
          samples={pageSamples}
          entries={entries}
          onCommit={handleGridCommit}
        />
      ) : (
        <DetailedView
          steps={steps}
          samples={pageSamples}
          entries={entries}
          onSaveEntry={handleDetailedSave}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span>Rows per page</span>
          <select
            className="h-8 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(0);
            }}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3 text-muted-foreground">
          <span>
            {enrolledSamples.length === 0 ? "0 of 0" : `${rangeStart}–${rangeEnd} of ${enrolledSamples.length}`}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="rounded-md border border-input px-3 py-1 hover:bg-accent disabled:opacity-50 disabled:hover:bg-transparent"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
              className="rounded-md border border-input px-3 py-1 hover:bg-accent disabled:opacity-50 disabled:hover:bg-transparent"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
