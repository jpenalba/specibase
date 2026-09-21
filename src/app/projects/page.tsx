"use client";

import { useCallback, useEffect, useState } from "react";
import { Project, SampleProjectLink } from "@/lib/projects-store";
import { ProjectDialog } from "@/components/projects/project-dialog";
import { ProjectCard } from "@/components/projects/project-card";
import { Button } from "@/components/ui/button";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [links, setLinks] = useState<SampleProjectLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Not called with loading reset to true on every refetch (e.g. after
  // adding a project) — only the very first load, which `loading`'s
  // initial state already covers, needs the "Loading..." placeholder.
  const load = useCallback(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => {
        if (data.errors?.length > 0) {
          setError(data.errors.join(" "));
        } else {
          setError(null);
          setProjects(data.projects ?? []);
          setLinks(data.links ?? []);
        }
      })
      .catch(() => setError("Couldn't reach the server."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6 sm:p-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Everything about each project — who&apos;s involved, what it&apos;s
            focused on, and how many samples are linked to it.
          </p>
        </div>
        <ProjectDialog onSaved={load} trigger={<Button>Add project</Button>} />
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Couldn&apos;t load projects: {error}. If you haven&apos;t already, run{" "}
          <code className="rounded bg-black/10 px-1">
            supabase/migrations/0002_project_details.sql
          </code>{" "}
          in the Supabase SQL Editor.
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No projects yet. Add one to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {projects.map((project) => {
            const sampleIds = links
              .filter((l) => l.project_id === project.id)
              .map((l) => l.sample_id);
            return (
              <ProjectCard
                key={project.id}
                project={project}
                sampleIds={sampleIds}
                onSaved={load}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
