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
  takenIdentifiers,
  onStage,
}: {
  takenIdentifiers: string[];
  onStage: (rows: RawRow[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  function reset() {
    setPreview(null);
    setFileName(null);
  }

  function handleFile(file: File) {
    setFileName(file.name);
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
      },
    });
  }

  function handleAddToStaging() {
    if (!preview) return;
    const validRows = preview.filter((p) => p.errors.length === 0).map((p) => p.row);
    onStage(validRows);
    setOpen(false);
    reset();
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
            disabled={!preview || validCount === 0 || hasDuplicates}
          >
            {`Stage ${validCount} valid row(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
