"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { SampleCustomColumn } from "@/lib/sample-custom-columns-store";
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

// The "Other: specify" custom fields on samples — global, not scoped to a
// project or workflow. Add/rename/delete here, from edit mode, mirroring
// the lab/bio workflows' own ManageDetailColumnsDialog (same "Custom
// column name" + add button at the bottom, minus the preset pills, since
// there's no fixed vocabulary to offer for a sample field).
export function ManageSampleColumnsDialog({
  columns,
  onSaved,
  trigger,
}: {
  columns: SampleCustomColumn[];
  onSaved: () => void;
  trigger: React.ReactNode;
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
    const label = newLabel.trim();
    if (!label) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/samples/custom-columns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
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

  function startRename(column: SampleCustomColumn) {
    setRenamingId(column.id);
    setRenameDraft(column.label);
  }

  async function saveRename() {
    if (!renamingId || !renameDraft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/samples/custom-columns/${renamingId}`, {
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

  async function handleDelete(column: SampleCustomColumn) {
    if (
      !window.confirm(
        `Delete column "${column.label}"? Any values entered in it, on any sample, are deleted too. This can't be undone.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/samples/custom-columns/${column.id}`, { method: "DELETE" });
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
            Custom, free-text columns for samples — every column here is user-named, added one at
            a time below. A CSV import with an unrecognized header creates one automatically too.
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
            placeholder="Custom column name"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <Button type="button" onClick={handleAdd} disabled={busy || !newLabel.trim()}>
            + Other
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
