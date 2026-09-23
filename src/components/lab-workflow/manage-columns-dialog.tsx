"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { LabWorkflowCustomColumn } from "@/lib/lab-workflows-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";

// Custom, free-text columns for a workflow's Simple grid — for things
// like an extraction or library name that don't fit the tick-box status
// model steps use. Unlike steps, there's no preset/custom distinction
// here: every column is user-named, so this dialog is just add/rename/
// remove, no picker.
export function ManageColumnsDialog({
  workflowId,
  columns,
  onSaved,
  trigger,
  apiBase = "/api/lab-workflows",
}: {
  workflowId: string;
  columns: LabWorkflowCustomColumn[];
  onSaved: () => void;
  trigger: React.ReactNode;
  // Defaults to Lab Workflow's own endpoint so existing callers don't need
  // to change; Bioinformatic Workflow passes "/api/bio-workflows".
  apiBase?: string;
}) {
  const [open, setOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setNewLabel("");
      setError(null);
      setRenamingId(null);
    }
  }

  async function handleAdd() {
    if (!newLabel.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/${workflowId}/custom-columns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.errors?.join(" ") ?? "Couldn't add the column.");
        return;
      }
      setNewLabel("");
      onSaved();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  function startRename(column: LabWorkflowCustomColumn) {
    setRenamingId(column.id);
    setRenameDraft(column.label);
  }

  async function saveRename() {
    if (!renamingId || !renameDraft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/${workflowId}/custom-columns/${renamingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: renameDraft }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.errors?.join(" ") ?? "Couldn't rename the column.");
        return;
      }
      setRenamingId(null);
      onSaved();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(column: LabWorkflowCustomColumn) {
    if (
      !window.confirm(
        `Delete column "${column.label}"? Any values entered in it are deleted too. This can't be undone.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/${workflowId}/custom-columns/${column.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      onSaved();
    } catch {
      setError("Couldn't delete the column.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage columns</DialogTitle>
          <DialogDescription>
            Custom text columns — for things like an extraction or library name — shown
            between Species and the step columns.
          </DialogDescription>
        </DialogHeader>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {columns.length > 0 && (
          <ul className="grid gap-1.5">
            {columns.map((column) => (
              <li
                key={column.id}
                className="flex items-center gap-2 rounded-md border border-input px-2 py-1.5"
              >
                {renamingId === column.id ? (
                  <>
                    <Input
                      className="h-7 flex-1"
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveRename()}
                      autoFocus
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={saveRename}
                      disabled={busy || !renameDraft.trim()}
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setRenamingId(null)}
                      disabled={busy}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="flex-1 truncate text-left text-sm hover:underline"
                      onClick={() => startRename(column)}
                    >
                      {column.label}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(column)}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Delete ${column.label}`}
                      disabled={busy}
                    >
                      <X className="size-4" />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2">
          <Input
            placeholder="e.g. Extraction name"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <Button type="button" onClick={handleAdd} disabled={busy || !newLabel.trim()}>
            Add
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
