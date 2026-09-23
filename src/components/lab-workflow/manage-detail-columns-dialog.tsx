"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { DETAIL_COLUMN_PRESETS, DetailColumnPreset } from "@/lib/lab-workflow-detail-columns";
import { LabWorkflowDetailColumn } from "@/lib/lab-workflows-store";
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

// Columns for a workflow's Detailed view (see detail-table.tsx). Unlike
// ManageColumnsDialog (Simple grid's free-text columns), adding one here
// picks from a preset list — or a custom label, added the same way as the
// presets rather than through a separate text field — mirroring StepBuilder's
// pill-based picker. The fixed Status column never appears in this list:
// it isn't user-managed.
export function ManageDetailColumnsDialog({
  workflowId,
  columns,
  onSaved,
  trigger,
  apiBase = "/api/lab-workflows",
  presets = DETAIL_COLUMN_PRESETS,
}: {
  workflowId: string;
  columns: LabWorkflowDetailColumn[];
  onSaved: () => void;
  trigger: React.ReactNode;
  // Defaults to Lab Workflow's own endpoint/vocabulary so existing callers
  // don't need to change; Bioinformatic Workflow passes "/api/bio-workflows"
  // and BIO_DETAIL_COLUMN_PRESETS.
  apiBase?: string;
  presets?: DetailColumnPreset[];
}) {
  const [open, setOpen] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const manageableColumns = columns.filter((c) => c.kind !== "status");

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setCustomLabel("");
      setError(null);
      setRenamingId(null);
    }
  }

  async function addColumn(label: string, kind: "text" | "date") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/${workflowId}/detail-columns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, kind }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.errors?.join(" ") ?? "Couldn't add the column.");
        return;
      }
      setCustomLabel("");
      onSaved();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  function addCustom() {
    const label = customLabel.trim();
    if (!label) return;
    addColumn(label, "text");
  }

  function startRename(column: LabWorkflowDetailColumn) {
    setRenamingId(column.id);
    setRenameDraft(column.label);
  }

  async function saveRename() {
    if (!renamingId || !renameDraft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/${workflowId}/detail-columns/${renamingId}`, {
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

  async function handleDelete(column: LabWorkflowDetailColumn) {
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
      const res = await fetch(`${apiBase}/${workflowId}/detail-columns/${column.id}`, {
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
          <DialogTitle>Manage detail columns</DialogTitle>
          <DialogDescription>
            Columns for the Detailed view. Sample ID and Status are always there — everything
            else is built one column at a time, picked from a preset or fully custom.
          </DialogDescription>
        </DialogHeader>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {manageableColumns.length > 0 && (
          <ul className="grid gap-1.5">
            {manageableColumns.map((column) => (
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

        <div className="grid gap-2">
          <div className="flex flex-wrap gap-1.5">
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => addColumn(preset.label, preset.kind)}
                disabled={busy}
                className="rounded-full border border-input px-2.5 py-1 text-xs hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
              >
                + {preset.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            <Input
              placeholder="Custom column name"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustom()}
              className="h-8"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={addCustom}
              disabled={busy || !customLabel.trim()}
            >
              + Other
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
