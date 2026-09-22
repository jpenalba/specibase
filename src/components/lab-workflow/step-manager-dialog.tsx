"use client";

import { useState } from "react";
import { LabWorkflowStep } from "@/lib/lab-workflows-store";
import { BuilderStep, StepBuilder } from "./step-builder";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";

function fromServerSteps(steps: LabWorkflowStep[]): BuilderStep[] {
  return steps
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((s) => ({ clientId: s.id, id: s.id, step_key: s.step_key, label: s.label }));
}

// Adds/renames/removes/reorders an *existing* workflow's steps — separate
// from WorkflowDialog because this has to diff against what's already on
// the server (and warn before removing a step with logged data) rather
// than just submitting a fresh list.
export function StepManagerDialog({
  workflowId,
  steps,
  entryCountByStepId,
  onSaved,
  trigger,
}: {
  workflowId: string;
  steps: LabWorkflowStep[];
  // How many entries exist for each step (across all samples) — used to
  // confirm before removing a step that already has logged data.
  entryCountByStepId: Map<string, number>;
  onSaved: () => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [builderSteps, setBuilderSteps] = useState<BuilderStep[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setBuilderSteps(fromServerSteps(steps));
      setErrors([]);
    }
  }

  function confirmRemove(step: BuilderStep): boolean {
    const count = step.id ? entryCountByStepId.get(step.id) ?? 0 : 0;
    if (count === 0) return true;
    return window.confirm(
      `"${step.label}" has ${count} logged entr${count === 1 ? "y" : "ies"}. Removing it deletes that data too. Continue?`
    );
  }

  async function handleSave() {
    if (builderSteps.length === 0) {
      setErrors(["A workflow needs at least one step"]);
      return;
    }
    setSaving(true);
    setErrors([]);
    try {
      const currentIds = new Set(builderSteps.filter((s) => s.id).map((s) => s.id));

      const removed = steps.filter((s) => !currentIds.has(s.id));
      const renamed = builderSteps.filter(
        (s) => s.id && steps.find((orig) => orig.id === s.id)?.label !== s.label
      );
      const added = builderSteps.filter((s) => !s.id);

      for (const step of removed) {
        const res = await fetch(`/api/lab-workflows/${workflowId}/steps/${step.id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Couldn't remove a step");
      }
      for (const step of renamed) {
        const res = await fetch(`/api/lab-workflows/${workflowId}/steps/${step.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: step.label }),
        });
        if (!res.ok) throw new Error("Couldn't rename a step");
      }

      // Newly added steps don't have a real id yet — resolve them by
      // posting the batch, then matching the response back to each
      // placeholder in the same order (both sides are ordered by the
      // position appendSteps assigns, ascending).
      let resolvedAdded: LabWorkflowStep[] = [];
      if (added.length > 0) {
        const res = await fetch(`/api/lab-workflows/${workflowId}/steps`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            steps: added.map((s) => ({ step_key: s.step_key, label: s.label })),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.errors?.[0] ?? "Couldn't add the new steps");
        resolvedAdded = (data.steps as LabWorkflowStep[]).slice().sort((a, b) => a.position - b.position);
      }

      let addedIndex = 0;
      const finalOrderIds = builderSteps.map((s) => s.id ?? resolvedAdded[addedIndex++].id);

      const reorderRes = await fetch(`/api/lab-workflows/${workflowId}/steps`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedStepIds: finalOrderIds }),
      });
      if (!reorderRes.ok) throw new Error("Couldn't save the step order");

      setOpen(false);
      onSaved();
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Couldn't save changes."]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit steps</DialogTitle>
          <DialogDescription>
            Add, rename, reorder, or remove steps. Removing a step with logged data deletes
            that data.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {errors.length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <ul className="list-disc pl-4">
                {errors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            </div>
          )}
          <StepBuilder steps={builderSteps} onChange={setBuilderSteps} onBeforeRemove={confirmRemove} />
          <DialogFooter>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
