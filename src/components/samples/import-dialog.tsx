"use client";

import { useState } from "react";
import Papa from "papaparse";
import { RawRow, validateRow } from "@/lib/validation";
import { DATE_FORMAT_LABEL } from "@/lib/dates";
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

export function ImportDialog({
  existingIdentifiers,
  onImported,
}: {
  existingIdentifiers: string[];
  onImported: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    insertedCount: number;
    skipped: { row: number; errors: string[] }[];
    duplicateIds: string[];
  } | null>(null);

  function reset() {
    setPreview(null);
    setFileName(null);
    setResult(null);
  }

  function handleFile(file: File) {
    setFileName(file.name);
    setResult(null);
    Papa.parse<RawRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const seenInFile = new Set(existingIdentifiers);
        const rows: PreviewRow[] = results.data.map((row) => {
          const { errors, duplicateId } = validateRow(row, seenInFile);
          const id = row.primary_identifier?.trim();
          if (id && errors.length === 0) seenInFile.add(id);
          return { row, errors, duplicateId };
        });
        setPreview(rows);
      },
    });
  }

  async function handleUpload() {
    if (!preview) return;
    setUploading(true);
    try {
      const res = await fetch("/api/samples/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: preview.map((p) => p.row) }),
      });
      const data = await res.json();
      setResult({
        insertedCount: data.inserted?.length ?? 0,
        skipped: data.skipped ?? [],
        duplicateIds: data.duplicateIds ?? [],
      });
      if ((data.duplicateIds?.length ?? 0) === 0) {
        onImported();
      }
    } finally {
      setUploading(false);
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
            Nothing is saved until you click Upload below. Sample ID,
            species, and valid latitude/longitude are required for a row to
            upload, dates must be {DATE_FORMAT_LABEL}, and duplicate Sample
            IDs block the whole upload rather than being skipped.
          </DialogDescription>
        </DialogHeader>

        {!result && (
          <>
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
                      found — fix your file before uploading:
                    </p>
                    <p className="mt-1">{duplicateIds.join(", ")}</p>
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
                onClick={handleUpload}
                disabled={!preview || validCount === 0 || hasDuplicates || uploading}
              >
                {uploading ? "Uploading..." : `Upload ${validCount} valid row(s)`}
              </Button>
            </DialogFooter>
          </>
        )}

        {result && (
          <>
            {result.duplicateIds.length > 0 ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                <p className="font-medium">
                  Upload blocked — duplicate Sample ID(s) found:
                </p>
                <p className="mt-1">{result.duplicateIds.join(", ")}</p>
                <p className="mt-2 text-muted-foreground">
                  Nothing was saved. Someone may have added one of these IDs
                  since you loaded this file — remove the duplicates and try
                  again.
                </p>
              </div>
            ) : (
              <div className="rounded-md border border-border p-3 text-sm">
                <p>
                  Uploaded{" "}
                  <span className="font-medium">{result.insertedCount}</span>{" "}
                  sample(s).
                </p>
                {result.skipped.length > 0 && (
                  <div className="mt-2">
                    <p className="text-destructive">
                      Skipped {result.skipped.length} row(s):
                    </p>
                    <ul className="list-disc pl-4 text-muted-foreground">
                      {result.skipped.map((s) => (
                        <li key={s.row}>
                          Row {s.row + 1}: {s.errors.join("; ")}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
