"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, ListChecks, DatabaseZap } from "lucide-react";
import { Collection } from "@/lib/collections-store";
import { COLLECTION_TYPE_LABELS } from "@/lib/collection-types";
import { parseCollaborators } from "@/lib/collaborators";
import { formatToDDMMYYYY } from "@/lib/dates";
import { CollectionIcon } from "./collection-icon";
import { CollectionDialog } from "./collection-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

export function CollectionCard({
  collection,
  sampleCount,
  onSaved,
}: {
  collection: Collection;
  sampleCount: number;
  onSaved: () => void;
}) {
  const contacts = parseCollaborators(collection.contacts);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  async function handleImport() {
    if (
      !window.confirm(
        `Add all ${sampleCount} sample(s) from "${collection.name}" to the main database? This collection's own record is kept either way.`
      )
    ) {
      return;
    }
    setImporting(true);
    setImportMessage(null);
    try {
      const res = await fetch(`/api/collections/${collection.id}/import-to-database`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setImportMessage(data.errors?.join(" ") ?? "Couldn't add these samples to the main database.");
        return;
      }
      if (data.duplicateIds?.length > 0) {
        setImportMessage(
          `Nothing added — these Sample IDs already exist in the main database: ${data.duplicateIds.join(", ")}`
        );
      } else {
        const inserted = data.inserted?.length ?? 0;
        const skipped = data.skipped?.length ?? 0;
        setImportMessage(
          `Added ${inserted} sample${inserted === 1 ? "" : "s"} to the main database.` +
            (skipped > 0 ? ` ${skipped} row(s) were skipped — see console for details.` : "")
        );
        if (skipped > 0) console.warn("Collection import skipped rows:", data.skipped);
      }
    } catch {
      setImportMessage("Couldn't reach the server.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start gap-3 space-y-0">
        <CollectionIcon />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold">{collection.name}</h3>
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
              {COLLECTION_TYPE_LABELS[collection.collection_type]}
            </span>
          </div>
          {collection.description && (
            <p className="text-sm text-muted-foreground">{collection.description}</p>
          )}
        </div>
        <CollectionDialog
          collection={collection}
          onSaved={onSaved}
          trigger={
            <button
              type="button"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              aria-label={`Edit ${collection.name}`}
            >
              <Pencil className="size-4" />
            </button>
          }
        />
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
          <Field label="Date added" value={formatToDDMMYYYY(collection.date_added)} />
          <Field label="Focal species/group" value={collection.focal_group} />
          <Field label="Collection location" value={collection.location} />
          {contacts.length > 0 && (
            <div className="col-span-2">
              <dt className="text-xs font-medium text-muted-foreground">Relevant contact(s)</dt>
              <dd className="flex flex-wrap gap-1 pt-1">
                {contacts.map((name) => (
                  <span
                    key={name}
                    className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground"
                  >
                    {name}
                  </span>
                ))}
              </dd>
            </div>
          )}
        </dl>
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-2">
        {importMessage && <p className="text-xs text-muted-foreground">{importMessage}</p>}
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {sampleCount} sample{sampleCount === 1 ? "" : "s"}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleImport}
              disabled={importing || sampleCount === 0}
              title="Copy this collection's samples into the main database"
            >
              <DatabaseZap className="size-4" />
              {importing ? "Adding..." : "Add to main database"}
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/collections/${collection.id}/samples`}>
                <ListChecks className="size-4" />
                Sample list
              </Link>
            </Button>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
