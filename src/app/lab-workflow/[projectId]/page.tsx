"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Project } from "@/lib/projects-store";
import { LabWorkflow } from "@/lib/lab-workflows-store";
import { FocalGroupIcon } from "@/components/projects/focal-group-icon";
import { ProjectStatusBadge } from "@/components/projects/project-status-badge";
import { WorkflowCard } from "@/components/lab-workflow/workflow-card";
import { WorkflowDialog } from "@/components/lab-workflow/workflow-dialog";
import { Button } from "@/components/ui/button";

export default function ProjectWorkflowsPage() {
  const { projectId } = useParams<{ projectId: string }>();

  const [project, setProject] = useState<Project | null>(null);
  const [workflows, setWorkflows] = useState<LabWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([
      fetch("/api/projects").then((res) => res.json()),
      fetch(`/api/lab-workflows?projectId=${projectId}`).then((res) => res.json()),
    ])
      .then(([projectsData, workflowsData]) => {
        if (projectsData.errors?.length > 0) {
          setError(projectsData.errors.join(" "));
          return;
        }
        setError(null);
        const found =
          (projectsData.projects ?? []).find((p: Project) => p.id === projectId) ?? null;
        setProject(found);
        setWorkflows(workflowsData.workflows ?? []);
      })
      .catch(() => setError("Couldn't reach the server."))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  function handleSaved() {
    load();
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl p-6 text-sm text-muted-foreground sm:p-10">Loading...</div>
    );
  }

  if (error || !project) {
    return (
      <div className="mx-auto max-w-6xl p-6 sm:p-10">
        <Link
          href="/lab-workflow"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="size-4" /> Back to Lab Workflow
        </Link>
        <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error ?? "Project not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6 sm:p-10">
      <Link
        href="/lab-workflow"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-4" /> Back to Lab Workflow
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <FocalGroupIcon focalGroup={project.focal_group} logo={project.logo} size={48} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold">{project.name}</h1>
              <ProjectStatusBadge status={project.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {workflows.length} workflow{workflows.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <WorkflowDialog
          projectId={projectId}
          onSaved={handleSaved}
          trigger={<Button>New workflow</Button>}
        />
      </div>

      {workflows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No workflows yet for this project. Create one to start tracking samples through the
          pipeline.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {workflows.map((workflow) => (
            <WorkflowCard
              key={workflow.id}
              projectId={projectId}
              workflow={workflow}
              onSaved={handleSaved}
            />
          ))}
        </div>
      )}
    </div>
  );
}
