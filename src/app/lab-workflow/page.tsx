"use client";

import { useCallback, useEffect, useState } from "react";
import { Project } from "@/lib/projects-store";
import { LabWorkflow } from "@/lib/lab-workflows-store";
import { ProjectWorkflowCard } from "@/components/lab-workflow/project-workflow-card";

export default function LabWorkflowPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [workflows, setWorkflows] = useState<LabWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([
      fetch("/api/projects").then((res) => res.json()),
      fetch("/api/lab-workflows").then((res) => res.json()),
    ])
      .then(([projectsData, workflowsData]) => {
        if (projectsData.errors?.length > 0) {
          setError(projectsData.errors.join(" "));
          return;
        }
        setError(null);
        setProjects(projectsData.projects ?? []);
        setWorkflows(workflowsData.workflows ?? []);
      })
      .catch(() => setError("Couldn't reach the server."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6 sm:p-10">
      <div>
        <h1 className="text-2xl font-semibold">Lab Workflow</h1>
        <p className="text-sm text-muted-foreground">
          Pick a project to see its lab workflows — extraction through sequencing, tracked
          per sample.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Couldn&apos;t load projects: {error}.
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No projects yet — add one on the Projects tab first.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {projects.map((project) => (
            <ProjectWorkflowCard
              key={project.id}
              project={project}
              workflowCount={workflows.filter((w) => w.project_id === project.id).length}
            />
          ))}
        </div>
      )}
    </div>
  );
}
