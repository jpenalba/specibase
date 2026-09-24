"use client";

import Link from "next/link";
import { FileText, Hammer, Pencil, Trash2 } from "lucide-react";
import { Protocol } from "@/lib/protocols-store";
import { PROTOCOL_TYPE_LABELS } from "@/lib/protocol-types";
import { formatToDDMMYYYY } from "@/lib/dates";
import { ProtocolDialog } from "./protocol-dialog";
import { Button } from "@/components/ui/button";

// One full-width row rather than a card — protocols are meant to be
// scanned top-to-bottom in a long list, unlike Projects/Collections'
// card grids.
export function ProtocolRow({
  protocol,
  onSaved,
  onDeleted,
}: {
  protocol: Protocol;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  async function handleDelete() {
    if (!window.confirm(`Delete "${protocol.name}"? This can't be undone.`)) return;
    try {
      const res = await fetch(`/api/protocols/${protocol.id}`, { method: "DELETE" });
      if (res.ok) onDeleted();
    } catch {
      // Best-effort — the row just stays put if this fails.
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border p-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
        {protocol.source_type === "pdf" ? (
          <FileText className="size-5" />
        ) : (
          <Hammer className="size-5" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-semibold">{protocol.name}</h3>
          <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
            {PROTOCOL_TYPE_LABELS[protocol.protocol_type]}
          </span>
        </div>
        {protocol.description && (
          <p className="truncate text-sm text-muted-foreground">{protocol.description}</p>
        )}
      </div>

      <p className="shrink-0 text-xs text-muted-foreground">
        Added {formatToDDMMYYYY(protocol.date_added)}
      </p>

      <div className="flex shrink-0 items-center gap-1">
        {protocol.source_type === "pdf" && protocol.pdf_url ? (
          <Button asChild variant="outline" size="sm">
            <a href={protocol.pdf_url} target="_blank" rel="noopener noreferrer">
              Open PDF
            </a>
          </Button>
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link href={`/protocols/${protocol.id}`}>Open</Link>
          </Button>
        )}
        <ProtocolDialog
          protocol={protocol}
          onSaved={onSaved}
          trigger={
            <button
              type="button"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              aria-label={`Edit ${protocol.name}`}
            >
              <Pencil className="size-4" />
            </button>
          }
        />
        <button
          type="button"
          onClick={handleDelete}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label={`Delete ${protocol.name}`}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
}
