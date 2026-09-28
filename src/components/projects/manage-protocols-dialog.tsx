"use client";

import { useState } from "react";
import { Protocol } from "@/lib/protocols-store";
import { PROTOCOL_TYPE_LABELS } from "@/lib/protocol-types";
import { ProtocolPicker } from "@/components/projects/protocol-picker";
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

// Same shape as ManageSamplesDialog — attach/detach existing protocols to
// this project. Detaching only removes the link, never the protocol
// itself (it's still shared, global reference material).
export function ManageProtocolsDialog({
  projectId,
  attachedProtocols,
  onSaved,
  trigger,
}: {
  projectId: string;
  attachedProtocols: Protocol[];
  onSaved: () => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [addSelection, setAddSelection] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const attachedIds = new Set(attachedProtocols.map((p) => p.id));

  async function handleDetach(protocolId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/protocols`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ protocolIds: [protocolId] }),
      });
      if (!res.ok) throw new Error();
      onSaved();
    } catch {
      setError("Couldn't detach that protocol.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAttach() {
    if (addSelection.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/protocols`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ protocolIds: [...addSelection] }),
      });
      if (!res.ok) throw new Error();
      setAddSelection(new Set());
      onSaved();
    } catch {
      setError("Couldn't attach the selected protocols.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Manage protocols</DialogTitle>
          <DialogDescription>
            Attach existing protocols to this project, or detach ones that no longer apply here.
            Detaching doesn&apos;t delete the protocol itself.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid gap-1.5">
          <Label>Attached ({attachedProtocols.length})</Label>
          <div className="max-h-40 overflow-y-auto rounded-md border border-input">
            {attachedProtocols.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">None yet — attach some below.</p>
            ) : (
              attachedProtocols.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 border-b border-input px-3 py-1.5 text-sm last:border-b-0"
                >
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                    {PROTOCOL_TYPE_LABELS[p.protocol_type]}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDetach(p.id)}
                    disabled={busy}
                  >
                    Detach
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        <ProtocolPicker selectedIds={addSelection} onChange={setAddSelection} excludeIds={attachedIds} />

        <DialogFooter>
          <Button type="button" onClick={handleAttach} disabled={addSelection.size === 0 || busy}>
            {busy ? "Attaching..." : `Attach ${addSelection.size} protocol(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
