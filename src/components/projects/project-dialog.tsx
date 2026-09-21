"use client";

import { useState } from "react";
import { Project, ProjectStatus } from "@/lib/projects-store";
import { parseDDMMYYYY, DATE_FORMAT_LABEL, formatToDDMMYYYY } from "@/lib/dates";
import { FOCAL_GROUP_CATEGORIES, categorizeFocalGroup, FocalGroupCategory } from "@/lib/focal-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FocalGroupIcon } from "./focal-group-icon";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";

type FormState = {
  name: string;
  description: string;
  startDate: string;
  owner: string;
  collaborators: string;
  focalGroup: string;
  focalRegion: string;
  // null means "auto-match from focal species/group" — see FocalGroupIcon.
  logo: FocalGroupCategory | null;
  status: ProjectStatus;
};

function emptyForm(): FormState {
  return {
    name: "",
    description: "",
    startDate: "",
    owner: "",
    collaborators: "",
    focalGroup: "",
    focalRegion: "",
    logo: null,
    status: "in_progress",
  };
}

function formFromProject(project: Project): FormState {
  return {
    name: project.name,
    description: project.description ?? "",
    startDate: project.start_date ? formatToDDMMYYYY(project.start_date) : "",
    owner: project.owner ?? "",
    collaborators: project.collaborators ?? "",
    focalGroup: project.focal_group ?? "",
    focalRegion: project.focal_region ?? "",
    logo: project.logo,
    status: project.status,
  };
}

// Handles both creating a new project (no `project` prop, POSTs) and
// editing an existing one (PATCHes) — one form, since the fields are
// identical either way and duplicating it would just be a maintenance
// hazard the next time a field's added.
export function ProjectDialog({
  project,
  onSaved,
  trigger,
}: {
  project?: Project;
  onSaved: () => void;
  trigger: React.ReactNode;
}) {
  const isEdit = Boolean(project);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<FormState>(() =>
    project ? formFromProject(project) : emptyForm()
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      // Reset each time it opens, so an earlier cancelled edit doesn't
      // linger into the next time this dialog is opened.
      setValues(project ? formFromProject(project) : emptyForm());
      setErrors([]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = values.name.trim();
    if (!name) {
      setErrors(["Project name is required"]);
      return;
    }
    let startDateIso: string | undefined;
    if (values.startDate.trim()) {
      const parsed = parseDDMMYYYY(values.startDate);
      if (!parsed) {
        setErrors([`Start date must be in ${DATE_FORMAT_LABEL} format`]);
        return;
      }
      startDateIso = parsed;
    }

    setSubmitting(true);
    setErrors([]);
    try {
      const url = project ? `/api/projects/${project.id}` : "/api/projects";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: values.description,
          start_date: startDateIso ?? "",
          owner: values.owner,
          collaborators: values.collaborators,
          focal_group: values.focalGroup,
          focal_region: values.focalRegion,
          logo: values.logo ?? "",
          status: values.status,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors(data.errors ?? [`Couldn't ${isEdit ? "save" : "create"} the project.`]);
        return;
      }
      setOpen(false);
      onSaved();
    } catch {
      setErrors(["Couldn't reach the server."]);
    } finally {
      setSubmitting(false);
    }
  }

  const autoCategory = categorizeFocalGroup(values.focalGroup);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit project" : "Add project"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this project's details."
              : "Set up a new project. You can link samples to it from the samples page or database."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          {errors.length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <ul className="list-disc pl-4">
                {errors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="project-name">Project name *</Label>
            <Input
              id="project-name"
              value={values.name}
              onChange={(e) => update("name", e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="project-description">Short description</Label>
            <Textarea
              id="project-description"
              rows={2}
              value={values.description}
              onChange={(e) => update("description", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="project-start-date">Start date</Label>
              <Input
                id="project-start-date"
                placeholder={DATE_FORMAT_LABEL}
                value={values.startDate}
                onChange={(e) => update("startDate", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="project-owner">Owner</Label>
              <Input
                id="project-owner"
                value={values.owner}
                onChange={(e) => update("owner", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="project-collaborators">Collaborators</Label>
            <Input
              id="project-collaborators"
              placeholder="Comma-separated, e.g. Jane Doe, John Smith"
              value={values.collaborators}
              onChange={(e) => update("collaborators", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="project-focal-group">Focal species/group</Label>
              <Input
                id="project-focal-group"
                value={values.focalGroup}
                onChange={(e) => update("focalGroup", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="project-focal-region">Focal region</Label>
              <Input
                id="project-focal-region"
                value={values.focalRegion}
                onChange={(e) => update("focalRegion", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Logo</Label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => update("logo", null)}
                className={cn(
                  "flex size-9 items-center justify-center rounded-full border-2",
                  values.logo === null ? "border-foreground" : "border-transparent hover:border-border"
                )}
                title={`Auto (currently: ${autoCategory})`}
              >
                <FocalGroupIcon logo={autoCategory} focalGroup={null} size={32} />
              </button>
              {FOCAL_GROUP_CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => update("logo", category)}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full border-2",
                    values.logo === category ? "border-foreground" : "border-transparent hover:border-border"
                  )}
                  title={category}
                >
                  <FocalGroupIcon logo={category} focalGroup={null} size={32} />
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {values.logo === null
                ? `Auto-matched from focal species/group (currently: ${autoCategory}).`
                : "Manually chosen — clears if you pick \"Auto\" above."}
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label>Status</Label>
            <div className="flex w-fit overflow-hidden rounded-md border border-input">
              {(["in_progress", "completed"] as ProjectStatus[]).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => update("status", status)}
                  className={cn(
                    "px-3 py-1.5 text-sm",
                    values.status === status
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent"
                  )}
                >
                  {status === "in_progress" ? "In progress" : "Completed"}
                </button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? isEdit
                  ? "Saving..."
                  : "Creating..."
                : isEdit
                  ? "Save changes"
                  : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
