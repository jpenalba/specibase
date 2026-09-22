"use client";

import { useMemo, useState } from "react";
import { SampleRecord } from "@/lib/samples-store";
import { compareIdentifiers } from "@/lib/utils";
import { SamplePicker } from "@/components/projects/sample-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";

// Hand-picks which of the project's samples are rows in this workflow's
// grid — deliberately a subset chosen per workflow, not automatically
// every project sample, since two workflows on one project (e.g. a ddRAD
// batch and a whole-genome batch) can track different sample sets.
export function ManageSamplesDialog({
  workflowId,
  allSamples,
  enrolledIds,
  onSaved,
  trigger,
}: {
  workflowId: string;
  allSamples: SampleRecord[];
  enrolledIds: Set<string>;
  onSaved: () => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [addSelection, setAddSelection] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enrolledSamples = useMemo(
    () =>
      allSamples
        .filter((s) => enrolledIds.has(s.id))
        .sort((a, b) => compareIdentifiers(a.primary_identifier, b.primary_identifier)),
    [allSamples, enrolledIds]
  );

  // Defaults to "every addable sample selected" — the lab deselects the
  // ones it doesn't want, rather than hand-picking from a blank slate.
  // Resets whenever the dialog opens, and again whenever the addable set
  // changes while it's open (e.g. right after a batch is added, so the
  // next round starts fresh too) — tracked by comparing enrolledIds'
  // identity against the last one seen, set during render rather than in
  // an effect, per React's "adjusting state when a prop changes" pattern.
  const [selectionSignal, setSelectionSignal] = useState<Set<string> | null>(null);
  const currentSignal = open ? enrolledIds : null;
  if (currentSignal !== selectionSignal) {
    setSelectionSignal(currentSignal);
    if (currentSignal) {
      setAddSelection(new Set(allSamples.filter((s) => !currentSignal.has(s.id)).map((s) => s.id)));
    }
  }

  async function handleRemove(sampleId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/lab-workflows/${workflowId}/samples`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sampleIds: [sampleId] }),
      });
      if (!res.ok) throw new Error();
      onSaved();
    } catch {
      setError("Couldn't remove that sample.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAdd() {
    if (addSelection.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/lab-workflows/${workflowId}/samples`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sampleIds: [...addSelection] }),
      });
      if (!res.ok) throw new Error();
      setAddSelection(new Set());
      onSaved();
    } catch {
      setError("Couldn't add the selected samples.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Manage samples</DialogTitle>
          <DialogDescription>
            Enrolled samples are the rows in this workflow&apos;s grid. Removing a sample here
            also deletes any progress logged for it in this workflow.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid gap-1.5">
          <Label>Enrolled ({enrolledSamples.length})</Label>
          <div className="max-h-40 overflow-y-auto rounded-md border border-input">
            {enrolledSamples.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">None yet — add some below.</p>
            ) : (
              enrolledSamples.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2 border-b border-input px-3 py-1.5 text-sm last:border-b-0"
                >
                  <span className="font-mono">{s.primary_identifier}</span>
                  <span className="flex-1 truncate text-muted-foreground">{s.species}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(s.id)}
                    disabled={busy}
                  >
                    Remove
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        <SamplePicker selectedIds={addSelection} onChange={setAddSelection} excludeIds={enrolledIds} />

        <DialogFooter>
          <Button type="button" onClick={handleAdd} disabled={addSelection.size === 0 || busy}>
            {busy ? "Adding..." : `Add ${addSelection.size} sample(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
