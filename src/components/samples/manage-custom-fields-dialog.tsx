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

// Rename/delete the "Other: specify" custom fields on samples — global,
// not scoped to a project or workflow. Adding one is normally done inline
// from the "Other: specify" control in the add/edit dialogs; this dialog
// is for fixing a typo or removing one that's no longer needed, mirroring
// the lab/bio workflows' own ManageColumnsDialog.
export function ManageCustomFieldsDialog({
  columns,
  onSaved,
  trigger,
}: {
  columns: SampleCustomColumn[];
  onSaved: () => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setError(null);
      setRenamingId(null);
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
        setError(data.errors?.join(" ") ?? "Couldn't rename the field.");
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
        `Delete field "${column.label}"? Any values entered in it, on any sample, are deleted too. This can't be undone.`
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
      setError("Couldn't delete the field.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage other fields</DialogTitle>
          <DialogDescription>
            The &quot;Other: specify&quot; fields added from the Add/Edit sample dialogs — rename
            or remove one here.
          </DialogDescription>
        </DialogHeader>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {columns.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            None yet — add one via &quot;Other: specify&quot; when adding or editing a sample.
          </p>
        ) : (
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
      </DialogContent>
    </Dialog>
  );
}
