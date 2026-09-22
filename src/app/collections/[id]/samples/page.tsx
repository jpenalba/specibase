"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Collection, CollectionSample } from "@/lib/collections-store";
import { RawRow } from "@/lib/validation";
import { getVisibleColumns } from "@/lib/fields";
import { useOptionalFields } from "@/lib/use-optional-fields";
import { CollectionIcon } from "@/components/collections/collection-icon";
import { AddSampleDialog } from "@/components/samples/add-sample-dialog";
import { ImportDialog } from "@/components/samples/import-dialog";
import { StagingTable, StagedSample } from "@/components/samples/staging-table";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

function newClientId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

export default function CollectionSamplesPage() {
  const { id: collectionId } = useParams<{ id: string }>();

  const { selected: visibleOptionalKeys } = useOptionalFields();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [samples, setSamples] = useState<CollectionSample[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [staged, setStaged] = useState<StagedSample[]>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(
    null
  );

  // Reused after every mutation (upload, delete) rather than patching
  // local state in place — matches the project sample-list page.
  const load = useCallback(() => {
    Promise.all([
      fetch("/api/collections").then((res) => res.json()),
      fetch(`/api/collections/${collectionId}/samples`).then((res) => res.json()),
    ])
      .then(([collectionsData, samplesData]) => {
        if (collectionsData.errors?.length > 0) {
          setError(collectionsData.errors.join(" "));
          return;
        }
        setError(null);
        const found =
          (collectionsData.collections ?? []).find((c: Collection) => c.id === collectionId) ??
          null;
        setCollection(found);
        setSamples(samplesData.samples ?? []);
      })
      .catch(() => setError("Couldn't reach the server."))
      .finally(() => setLoading(false));
  }, [collectionId]);

  useEffect(() => {
    load();
  }, [load]);

  const takenIdentifiers = [
    ...samples.map((s) => s.primary_identifier),
    ...staged
      .map((s) => s.row.primary_identifier?.trim())
      .filter((id): id is string => Boolean(id)),
  ];

  function stageOne(row: RawRow) {
    setStaged((prev) => [...prev, { clientId: newClientId(), row }]);
    setMessage(null);
  }

  function stageMany(rows: RawRow[]) {
    setStaged((prev) => [...prev, ...rows.map((row) => ({ clientId: newClientId(), row }))]);
    setMessage(null);
  }

  function removeStaged(clientId: string) {
    setStaged((prev) => prev.filter((s) => s.clientId !== clientId));
  }

  async function handleUpload() {
    if (staged.length === 0) return;
    setUploading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/collections/${collectionId}/samples`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: staged.map((s) => s.row) }),
      });
      const data = await res.json();

      if (data.duplicateIds?.length > 0) {
        setMessage({
          tone: "error",
          text: `Upload blocked — Sample ID(s) already in this collection: ${data.duplicateIds.join(", ")}. Remove them from staging and try again.`,
        });
        return;
      }

      const insertedIds = new Set(
        (data.inserted ?? []).map((s: { primary_identifier: string }) => s.primary_identifier)
      );
      setStaged((prev) => prev.filter((s) => !insertedIds.has(s.row.primary_identifier?.trim())));

      let text = `Uploaded ${insertedIds.size} sample(s).`;
      if (data.skipped?.length > 0) {
        text += ` ${data.skipped.length} row(s) were skipped — they're still staged below.`;
      }
      if (data.errors?.length > 0) {
        text += ` ${data.errors.join(" ")}`;
      }
      setMessage({ tone: data.errors?.length > 0 ? "error" : "success", text });
      load();
    } catch {
      setMessage({ tone: "error", text: "Upload failed — check your connection and try again." });
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(sampleId: string, identifier: string) {
    if (
      !window.confirm(`Delete sample "${identifier}" from this collection? This can't be undone.`)
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/collections/${collectionId}/samples/${sampleId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        load();
      } else {
        setMessage({ tone: "error", text: "Couldn't delete that sample." });
      }
    } catch {
      setMessage({ tone: "error", text: "Couldn't reach the server." });
    }
  }

  const columns = getVisibleColumns(visibleOptionalKeys);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl p-6 text-sm text-muted-foreground sm:p-10">Loading...</div>
    );
  }

  if (error || !collection) {
    return (
      <div className="mx-auto max-w-6xl p-6 sm:p-10">
        <Link
          href="/collections"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="size-4" /> Back to collections
        </Link>
        <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error ?? "Collection not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6 sm:p-10">
      <Link
        href="/collections"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="size-4" /> Back to collections
      </Link>

      <div className="flex items-start gap-3">
        <CollectionIcon size={48} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold">{collection.name}</h1>
          {collection.description && (
            <p className="mt-1 text-sm text-muted-foreground">{collection.description}</p>
          )}
        </div>
      </div>

      {message && (
        <div
          className={
            message.tone === "success"
              ? "rounded-md border border-border bg-muted p-3 text-sm"
              : "rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          }
        >
          {message.text}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Collection samples</CardTitle>
          <CardDescription>
            {samples.length} sample{samples.length === 1 ? "" : "s"} in this collection — kept
            separate from the main database.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {samples.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              No samples yet. Add some below.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map((col) => (
                      <TableHead key={col.key}>{col.label}</TableHead>
                    ))}
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {samples.map((sample) => (
                    <TableRow key={sample.id}>
                      {columns.map((col) => (
                        <TableCell key={col.key}>
                          {sample[col.key] ? (
                            String(sample[col.key])
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      ))}
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(sample.id, sample.primary_identifier)}
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Add samples</CardTitle>
            <CardDescription>
              Stage samples here, then upload — same as the main Add samples page, but into
              this collection&apos;s own table instead of the main database.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <ImportDialog takenIdentifiers={takenIdentifiers} onStage={stageMany} />
            <AddSampleDialog
              visibleOptionalKeys={visibleOptionalKeys}
              takenIdentifiers={takenIdentifiers}
              onStage={stageOne}
            />
          </div>
        </CardHeader>
        <CardContent>
          <StagingTable staged={staged} visibleOptionalKeys={visibleOptionalKeys} onRemove={removeStaged} />
        </CardContent>
        <CardFooter>
          <Button onClick={handleUpload} disabled={staged.length === 0 || uploading}>
            {uploading ? "Uploading..." : `Upload ${staged.length} sample(s) to this collection`}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
