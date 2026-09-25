"use client";

import { useState } from "react";
import Papa from "papaparse";
import { RawRow, validateRow } from "@/lib/validation";
import { DATE_FORMAT_LABEL } from "@/lib/dates";
import { ALL_FIELDS } from "@/lib/fields";
import { SampleCustomColumn, customColumnKey } from "@/lib/sample-custom-columns-store";
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
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

type PreviewRow = {
  row: RawRow;
  errors: string[];
  duplicateId?: string;
};

const KNOWN_KEYS = new Set(ALL_FIELDS.map((f) => f.key));

// Renames every key in `row` that's a header mapped to a custom column
// (i.e. wasn't a recognized field key) to "custom:<column id>" — the same
// shape insertSample/updateSample expect — leaving every recognized key
// untouched.
function remapUnmatchedHeaders(row: RawRow, headerToColumnId: Map<string, string>): RawRow {
  const next: RawRow = {};
  for (const [key, value] of Object.entries(row)) {
    const columnId = headerToColumnId.get(key);
    next[columnId ? customColumnKey(columnId) : key] = value;
  }
  return next;
}

export function ImportDialog({
  takenIdentifiers,
  onStage,
  customColumns = [],
  onCustomColumnAdded,
}: {
  takenIdentifiers: string[];
  onStage: (rows: RawRow[]) => void;
  // Existing "Other: specify" custom columns, reused by exact label match
  // instead of creating a duplicate — optional so a caller with nowhere to
  // attach sample-scoped values (Collections' own staging flow, which
  // imports into a different table with no sample_id yet) can leave both
  // out, in which case an unrecognized header is just left as-is.
  customColumns?: SampleCustomColumn[];
  onCustomColumnAdded?: (column: SampleCustomColumn) => void;
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [unmatchedHeaders, setUnmatchedHeaders] = useState<string[]>([]);
  const [staging, setStaging] = useState(false);
  const [stageError, setStageError] = useState<string | null>(null);

  function reset() {
    setPreview(null);
    setFileName(null);
    setUnmatchedHeaders([]);
    setStageError(null);
  }

  function handleFile(file: File) {
    setFileName(file.name);
    setStageError(null);
    Papa.parse<RawRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const seen = new Set(takenIdentifiers);
        const rows: PreviewRow[] = results.data.map((row) => {
          const { errors, duplicateId } = validateRow(row, seen);
          const id = row.primary_identifier?.trim();
          if (id && errors.length === 0) seen.add(id);
          return { row, errors, duplicateId };
        });
        setPreview(rows);
        const headers = results.meta.fields ?? [];
        setUnmatchedHeaders(
          onCustomColumnAdded ? headers.filter((h) => h && !KNOWN_KEYS.has(h)) : []
        );
      },
    });
  }

  // Any header that isn't one of the predefined field keys gets its own
  // custom column (reusing one that already has that exact label, rather
  // than creating a duplicate on a repeat import) — same "Other: specify"
  // columns the Manage columns dialog creates, just created here instead.
  async function handleAddToStaging() {
    if (!preview) return;
    setStaging(true);
    setStageError(null);
    try {
      const headerToColumnId = new Map<string, string>();
      for (const column of customColumns) headerToColumnId.set(column.label, column.id);
      for (const header of unmatchedHeaders) {
        if (headerToColumnId.has(header)) continue;
        const res = await fetch("/api/samples/custom-columns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: header }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setStageError(data.errors?.join(" ") ?? `Couldn't create a column for "${header}".`);
          return;
        }
        headerToColumnId.set(header, data.column.id);
        onCustomColumnAdded?.(data.column);
      }

      const validRows = preview
        .filter((p) => p.errors.length === 0)
        .map((p) => remapUnmatchedHeaders(p.row, headerToColumnId));
      onStage(validRows);
      setOpen(false);
      reset();
    } catch {
      setStageError("Couldn't reach the server.");
    } finally {
      setStaging(false);
    }
  }

  const duplicateIds = [
    ...new Set(
      (preview ?? [])
        .map((p) => p.duplicateId)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const hasDuplicates = duplicateIds.length > 0;
  const validCount = preview?.filter((p) => p.errors.length === 0).length ?? 0;
  const invalidCount = (preview?.length ?? 0) - validCount;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">Import CSV</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import samples from CSV</DialogTitle>
          <DialogDescription>
            This stages rows below — nothing is saved to the database until
            you upload the staged batch. Sample ID and species are required;
            provide either latitude &amp; longitude or a locality; dates must
            be {DATE_FORMAT_LABEL}. Duplicate Sample IDs block the whole file
            rather than being skipped.
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

        {preview && (
          <>
            {hasDuplicates && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                <p className="font-medium">
                  Duplicate Sample ID{duplicateIds.length === 1 ? "" : "s"}{" "}
                  found — fix your file before staging it:
                </p>
                <p className="mt-1">{duplicateIds.join(", ")}</p>
              </div>
            )}

            {unmatchedHeaders.length > 0 && (
              <div className="rounded-md border border-border bg-muted p-3 text-sm">
                <p>
                  Column name{unmatchedHeaders.length === 1 ? "" : "s"}{" "}
                  <span className="font-medium">{unmatchedHeaders.join(", ")}</span>{" "}
                  {unmatchedHeaders.length === 1 ? "does" : "do"} not exist in the predefined
                  selection — custom column{unmatchedHeaders.length === 1 ? "" : "s"} will be
                  created for {unmatchedHeaders.length === 1 ? "it" : "them"} when you stage this
                  file. If the data actually matches one of the predefined columns, please use
                  that column&apos;s key as the header instead.
                </p>
              </div>
            )}

            {stageError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {stageError}
              </div>
            )}

            <div className="text-sm">
              <span className="font-medium">{fileName}</span> —{" "}
              {validCount} row{validCount === 1 ? "" : "s"} ready,{" "}
              {invalidCount > 0 && (
                <span className="text-destructive">
                  {invalidCount} with errors
                </span>
              )}
              {invalidCount === 0 && "no errors"}
            </div>
            <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Sample ID</TableHead>
                    <TableHead>Species</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>{p.row.primary_identifier || "—"}</TableCell>
                      <TableCell>{p.row.species || "—"}</TableCell>
                      <TableCell>
                        {p.errors.length === 0 ? (
                          <span className="text-green-600">OK</span>
                        ) : (
                          <span className="text-destructive">
                            {p.errors.join("; ")}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        <DialogFooter>
          <Button
            onClick={handleAddToStaging}
            disabled={!preview || validCount === 0 || hasDuplicates || staging}
          >
            {staging ? "Staging..." : `Stage ${validCount} valid row(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
