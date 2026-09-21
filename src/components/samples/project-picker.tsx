"use client";

import { useCallback, useEffect, useState } from "react";
import { Project } from "@/lib/projects-store";
import { ProjectDialog } from "@/components/projects/project-dialog";
import { Label } from "@/components/ui/label";

export type ProjectSelection = { mode: "none" } | { mode: "existing"; projectId: string };

export function ProjectPicker({
  selection,
  onChange,
}: {
  selection: ProjectSelection;
  onChange: (selection: ProjectSelection) => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [newDialogOpen, setNewDialogOpen] = useState(false);

  const load = useCallback(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => {
        if (data.errors?.length > 0) {
          setLoadError(true);
          return;
        }
        setLoadError(false);
        setProjects(data.projects ?? []);
      })
      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    load();
    // A project created on the Projects page (or in another tab) after
    // this page was first opened wouldn't otherwise show up here without
    // a hard reload — refetch whenever this tab regains focus.
    window.addEventListener("focus", load);
    return () => window.removeEventListener("focus", load);
  }, [load]);

  return (
    <div className="grid gap-2">
      <Label htmlFor="project-select">Associate with a project?</Label>
      <select
        id="project-select"
        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        value={selection.mode === "existing" ? selection.projectId : "none"}
        onChange={(e) => {
          const value = e.target.value;
          if (value === "none") onChange({ mode: "none" });
          else if (value === "new") setNewDialogOpen(true);
          else onChange({ mode: "existing", projectId: value });
        }}
      >
        <option value="none">Main database only</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
        <option value="new">+ New project...</option>
      </select>
      {loadError && (
        <p className="text-xs text-destructive">
          Couldn&apos;t load existing projects — you can still create a new one.
        </p>
      )}
      <ProjectDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        onSaved={() => {}}
        onCreated={(project) => {
          setProjects((prev) => [...prev, project].sort((a, b) => a.name.localeCompare(b.name)));
          onChange({ mode: "existing", projectId: project.id });
        }}
      />
    </div>
  );
}
