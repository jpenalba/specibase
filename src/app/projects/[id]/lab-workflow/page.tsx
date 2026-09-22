"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { LabWorkflow } from "@/lib/lab-workflows-store";
import { WorkflowCard } from "@/components/lab-workflow/workflow-card";
import { WorkflowDialog } from "@/components/lab-workflow/workflow-dialog";
import { Button } from "@/components/ui/button";

export default function ProjectWorkflowsPage() {
  const { id: projectId } = useParams<{ id: string }>();

  const [workflows, setWorkflows] = useState<LabWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/lab-workflows?projectId=${projectId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.errors?.length > 0) {
          setError(data.errors.join(" "));
          return;
        }
        setError(null);
        setWorkflows(data.workflows ?? []);
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
    <div className="mx-auto grid w-full max-w-6xl gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {workflows.length} workflow{workflows.length === 1 ? "" : "s"}
        </p>
        <WorkflowDialog projectId={projectId} onSaved={load} trigger={<Button>New workflow</Button>} />
      </div>

      {workflows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No workflows yet for this project. Create one to start tracking samples through the
          pipeline.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {workflows.map((workflow) => (
            <WorkflowCard key={workflow.id} projectId={projectId} workflow={workflow} onSaved={load} />
          ))}
        </div>
      )}
    </div>
  );
}
