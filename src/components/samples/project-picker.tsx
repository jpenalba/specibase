"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Project = { id: string; name: string };

export type ProjectSelection =
  | { mode: "none" }
  | { mode: "existing"; projectId: string }
  | { mode: "new"; name: string };

export function ProjectPicker({
  selection,
  onChange,
}: {
  selection: ProjectSelection;
  onChange: (selection: ProjectSelection) => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setProjects(data.projects ?? []);
      })
      .catch(() => {
        // Projects are a nice-to-have here — an empty list just means
        // "existing project" isn't offered yet, not a hard failure.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="grid gap-2">
      <Label htmlFor="project-select">Associate with a project?</Label>
      <select
        id="project-select"
        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        value={selection.mode === "existing" ? selection.projectId : selection.mode}
        onChange={(e) => {
          const value = e.target.value;
          if (value === "none") onChange({ mode: "none" });
          else if (value === "new") onChange({ mode: "new", name: "" });
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
      {selection.mode === "new" && (
        <Input
          placeholder="New project name"
          value={selection.name}
          onChange={(e) => onChange({ mode: "new", name: e.target.value })}
        />
      )}
    </div>
  );
}
