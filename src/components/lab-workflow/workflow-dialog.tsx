"use client";

import { useState } from "react";
import { LabWorkflow, WorkflowStatus } from "@/lib/lab-workflows-store";
import { STEP_PRESETS } from "@/lib/lab-workflow-steps";
import { BuilderStep, StepBuilder, newBuilderStep } from "./step-builder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type StepPresetLike = { key: string; label: string };

// A new workflow starts pre-populated with the full default step set
// (everything but "Other", which is the customization affordance rather
// than a concrete step) — removing a step a lab doesn't need is a smaller
// ask than adding them all one at a time.
function defaultSteps(presets: StepPresetLike[]): BuilderStep[] {
  return presets.filter((p) => p.key !== "custom").map((p) => newBuilderStep(p.key, p.label));
}

// Creates a new workflow (name + initial steps, both submitted together —
// see lab-workflows-store's createWorkflow) or edits an existing one's
// name/status. Editing an existing workflow's *steps* happens separately,
// on the workflow's own page (StepManagerDialog), since diffing a step
// list that may already have sample data logged against it is a bigger
// operation than this dialog's single POST/PATCH.
export function WorkflowDialog({
  projectId,
  workflow,
  onSaved,
  onDeleted,
  trigger,
  open: openProp,
  onOpenChange: onOpenChangeProp,
  apiBase = "/api/lab-workflows",
  stepPresets = STEP_PRESETS,
}: {
  projectId: string;
  workflow?: LabWorkflow;
  onSaved: (workflow: LabWorkflow) => void;
  // Only relevant in edit mode — called after the workflow is deleted so
  // the caller can drop its section from the page.
  onDeleted?: () => void;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  // Defaults to Lab Workflow's own endpoints/vocabulary so existing callers
  // don't need to change; Bioinformatic Workflow passes "/api/bio-workflows"
  // and BIO_STEP_PRESETS.
  apiBase?: string;
  stepPresets?: StepPresetLike[];
}) {
  const isEdit = Boolean(workflow);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const [name, setName] = useState(workflow?.name ?? "");
  const [status, setStatus] = useState<WorkflowStatus>(workflow?.status ?? "in_progress");
  const [steps, setSteps] = useState<BuilderStep[]>(defaultSteps(stepPresets));
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function setOpen(next: boolean) {
    if (onOpenChangeProp) onOpenChangeProp(next);
    else setInternalOpen(next);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setName(workflow?.name ?? "");
      setStatus(workflow?.status ?? "in_progress");
      setSteps(defaultSteps(stepPresets));
      setErrors([]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrors(["Workflow name is required"]);
      return;
    }
    if (!isEdit && steps.length === 0) {
      setErrors(["At least one step is required"]);
      return;
    }

    setSubmitting(true);
    setErrors([]);
    try {
      const url = workflow ? `${apiBase}/${workflow.id}` : apiBase;
      const body = isEdit
        ? { name: trimmedName, status }
        : {
            project_id: projectId,
            name: trimmedName,
            steps: steps.map((s) => ({ step_key: s.step_key, label: s.label })),
          };
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors(data.errors ?? [`Couldn't ${isEdit ? "save" : "create"} the workflow.`]);
        return;
      }
      setOpen(false);
      onSaved(data.workflow);
    } catch {
      setErrors(["Couldn't reach the server."]);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!workflow) return;
    if (
      !window.confirm(
        `Delete workflow "${workflow.name}"? This removes all of its steps and logged progress. This can't be undone.`
      )
    ) {
      return;
    }
    setDeleting(true);
    setErrors([]);
    try {
      const res = await fetch(`${apiBase}/${workflow.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrors(data.errors ?? ["Couldn't delete the workflow."]);
        return;
      }
      setOpen(false);
      onDeleted?.();
    } catch {
      setErrors(["Couldn't reach the server."]);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit workflow" : "New workflow"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Rename this workflow or mark it completed."
              : "Starts with the default step set — remove any you don't need, or add a custom one, then adjust further any time from the workflow page."}
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
            <Label htmlFor="workflow-name">Workflow name *</Label>
            <Input
              id="workflow-name"
              placeholder="e.g. ddRAD batch 1"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {isEdit ? (
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <div className="flex w-fit overflow-hidden rounded-md border border-input">
                {(["in_progress", "completed"] as WorkflowStatus[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={cn(
                      "px-3 py-1.5 text-sm",
                      status === s ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                    )}
                  >
                    {s === "in_progress" ? "In progress" : "Completed"}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <StepBuilder steps={steps} onChange={setSteps} presets={stepPresets} />
          )}

          <DialogFooter className={isEdit ? "sm:justify-between" : undefined}>
            {isEdit && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={submitting || deleting}
              >
                {deleting ? "Deleting..." : "Delete workflow"}
              </Button>
            )}
            <Button type="submit" disabled={submitting || deleting}>
              {submitting
                ? isEdit
                  ? "Saving..."
                  : "Creating..."
                : isEdit
                  ? "Save changes"
                  : "Create workflow"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
