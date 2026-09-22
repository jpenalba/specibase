"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { LabWorkflow } from "@/lib/lab-workflows-store";
import { SampleRecord } from "@/lib/samples-store";
import { WorkflowDialog } from "@/components/lab-workflow/workflow-dialog";
import { WorkflowSection } from "@/components/lab-workflow/workflow-section";
import { Button } from "@/components/ui/button";

// No intermediate "pick a workflow" list — every workflow for this
// project renders its own full grid here, stacked top to bottom, so
// opening the tab goes straight into the grid view(s). "New workflow"
// always sits at the bottom and just appends another section once
// created, regardless of how many (and how different) the existing
// ones' pipelines are.
export default function ProjectWorkflowsPage() {
  const { id: projectId } = useParams<{ id: string }>();

  const [workflows, setWorkflows] = useState<LabWorkflow[]>([]);
  const [allSamples, setAllSamples] = useState<SampleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([
      fetch(`/api/lab-workflows?projectId=${projectId}`).then((res) => res.json()),
      fetch("/api/samples").then((res) => res.json()),
    ])
      .then(([workflowsData, samplesData]) => {
        if (workflowsData.errors?.length > 0) {
          setError(workflowsData.errors.join(" "));
          return;
        }
        setError(null);
        setWorkflows(workflowsData.workflows ?? []);
        setAllSamples(samplesData.samples ?? []);
      })
      .catch(() => setError("Couldn't reach the server."))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <p className="mx-auto max-w-6xl text-sm text-muted-foreground">Loading...</p>;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-[100rem] gap-6">
      {workflows.length === 0 ? (
        <div className="mx-auto w-full max-w-6xl rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No workflows yet for this project. Create one below to start tracking samples
          through the pipeline.
        </div>
      ) : (
        workflows.map((workflow) => (
          <WorkflowSection
            key={workflow.id}
            projectId={projectId}
            workflowId={workflow.id}
            allSamples={allSamples}
            onDeleted={load}
          />
        ))
      )}

      <div className="mx-auto w-fit">
        <WorkflowDialog projectId={projectId} onSaved={load} trigger={<Button>New workflow</Button>} />
      </div>
    </div>
  );
}
