"use client";

import { useState } from "react";
import Papa from "papaparse";
import { LabWorkflowDetailRow } from "@/lib/lab-workflows-store";
import { SampleRecord } from "@/lib/samples-store";
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

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const MAX_LISTED_UNMATCHED = 20;

type MatchedRow = { rowId: string; identifier: string; values: string[] };

type ParsedPreview = {
  newColumnLabels: string[];
  matched: MatchedRow[];
  unmatchedIdentifiers: string[];
};

// Lets a lab or bioinformatic pipeline's output CSV (from an external tool)
// get merged into a workflow's Detailed table — matched against samples
// already there by a "Sample ID" column, with every other CSV column
// becoming a brand-new detail column. Composed entirely from the existing
// detail-columns/detail-values endpoints rather than a dedicated import
// route, since adding a column and bulk-upserting values is exactly what
// ManageDetailColumnsDialog and DetailTable's own saves already do.
export function DetailImportDialog({
  workflowId,
  samples,
  rows,
  onImported,
  trigger,
  apiBase = "/api/lab-workflows",
}: {
  workflowId: string;
  // Every sample currently enrolled in this workflow — a CSV row's Sample
  // ID only matches against these, not the whole database.
  samples: SampleRecord[];
  rows: LabWorkflowDetailRow[];
  onImported: () => void;
  trigger: React.ReactNode;
  // Defaults to Lab Workflow's own endpoint so existing callers don't need
  // to change; Bioinformatic Workflow passes "/api/bio-workflows".
  apiBase?: string;
}) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ParsedPreview | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  function reset() {
    setFileName(null);
    setPreview(null);
    setParseError(null);
    setImportError(null);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  function handleFile(file: File) {
    setFileName(file.name);
    setParseError(null);
    setImportError(null);
    setPreview(null);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields ?? [];
        const idHeader = headers.find((h) => normalizeHeader(h) === "sampleid");
        if (!idHeader) {
          setParseError('No "Sample ID" column found in this file — add one and try again.');
          return;
        }
        const otherHeaders = headers.filter((h) => h !== idHeader);
        if (otherHeaders.length === 0) {
          setParseError("This file has no columns besides Sample ID — nothing to import.");
          return;
        }

        // The latest attempt's row — a redone sample's earlier attempts
        // aren't what new external results should land on.
        const latestRowBySample = new Map<string, LabWorkflowDetailRow>();
        for (const row of rows) {
          const current = latestRowBySample.get(row.sample_id);
          if (!current || row.attempt_number > current.attempt_number) {
            latestRowBySample.set(row.sample_id, row);
          }
        }
        const rowIdByIdentifier = new Map<string, string>();
        for (const sample of samples) {
          const row = latestRowBySample.get(sample.id);
          if (row) rowIdByIdentifier.set(sample.primary_identifier, row.id);
        }

        // Keyed by identifier rather than pushed to a plain array — a CSV
        // that repeats the same Sample ID would otherwise target the same
        // row twice in one batch, which upsertDetailValues's single
        // multi-row upsert can't do (Postgres rejects touching the same
        // conflict target twice in one statement). Last occurrence wins.
        const matchedByIdentifier = new Map<string, MatchedRow>();
        const unmatchedIdentifiers: string[] = [];
        for (const csvRow of results.data) {
          const identifier = (csvRow[idHeader] ?? "").trim();
          if (!identifier) continue;
          const rowId = rowIdByIdentifier.get(identifier);
          if (!rowId) {
            unmatchedIdentifiers.push(identifier);
            continue;
          }
          matchedByIdentifier.set(identifier, {
            rowId,
            identifier,
            values: otherHeaders.map((h) => (csvRow[h] ?? "").trim()),
          });
        }

        setPreview({
          newColumnLabels: otherHeaders,
          matched: [...matchedByIdentifier.values()],
          unmatchedIdentifiers,
        });
      },
    });
  }

  async function handleImport() {
    if (!preview) return;
    setImporting(true);
    setImportError(null);
    try {
      // Sequential, not Promise.all — addDetailColumn positions a new
      // column after however many already exist at the moment it's
      // called, so firing these concurrently would race and could give
      // two new columns the same position.
      const columnIds: string[] = [];
      for (const label of preview.newColumnLabels) {
        const res = await fetch(`${apiBase}/${workflowId}/detail-columns`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label, kind: "text" }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setImportError(data.errors?.join(" ") ?? `Couldn't add column "${label}".`);
          return;
        }
        const data = await res.json();
        columnIds.push(data.column.id);
      }

      const values = preview.matched.flatMap((m) =>
        columnIds.map((columnId, i) => ({
          column_id: columnId,
          row_id: m.rowId,
          value: m.values[i] || null,
        }))
      );
      if (values.length > 0) {
        const res = await fetch(`${apiBase}/${workflowId}/detail-values`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ values }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setImportError(data.errors?.join(" ") ?? "Couldn't save the imported values.");
          return;
        }
      }

      setOpen(false);
      reset();
      onImported();
    } catch {
      setImportError("Couldn't reach the server.");
    } finally {
      setImporting(false);
    }
  }

  const shownUnmatched = preview?.unmatchedIdentifiers.slice(0, MAX_LISTED_UNMATCHED) ?? [];
  const extraUnmatched = (preview?.unmatchedIdentifiers.length ?? 0) - shownUnmatched.length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import CSV</DialogTitle>
          <DialogDescription>
            Needs a &quot;Sample ID&quot; column matching samples already in this table. Every
            other column is added as a new one at the end, filled in for whichever rows match —
            do this as many times as you like, each import just appends more columns. Importing
            the same file twice adds duplicate columns rather than overwriting the first import.
          </DialogDescription>
        </DialogHeader>

        <input
          type="file"
          accept=".csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
          className="text-sm"
        />

        {parseError && <p className="text-sm text-destructive">{parseError}</p>}
        {importError && <p className="text-sm text-destructive">{importError}</p>}

        {preview && (
          <div className="grid gap-2 text-sm">
            <p>
              <span className="font-medium">{fileName}</span> — adding{" "}
              {preview.newColumnLabels.length} column{preview.newColumnLabels.length === 1 ? "" : "s"}:{" "}
              {preview.newColumnLabels.join(", ")}
            </p>
            <p>
              {preview.matched.length} sample{preview.matched.length === 1 ? "" : "s"} matched and
              ready to import.
            </p>
            {preview.unmatchedIdentifiers.length > 0 && (
              <p className="text-destructive">
                {preview.unmatchedIdentifiers.length} unmatched Sample ID
                {preview.unmatchedIdentifiers.length === 1 ? "" : "s"} skipped: {shownUnmatched.join(", ")}
                {extraUnmatched > 0 && ` and ${extraUnmatched} more`}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            onClick={handleImport}
            disabled={!preview || preview.matched.length === 0 || importing}
          >
            {importing ? "Importing…" : preview ? `Import ${preview.matched.length} row(s)` : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
