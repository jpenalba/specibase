"use client";

import { useCallback, useEffect, useState } from "react";
import { Collection, CollectionSampleRef } from "@/lib/collections-store";
import { CollectionDialog } from "@/components/collections/collection-dialog";
import { CollectionCard } from "@/components/collections/collection-card";
import { Button } from "@/components/ui/button";

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [sampleRefs, setSampleRefs] = useState<CollectionSampleRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Not called with loading reset to true on every refetch (e.g. after
  // adding a collection) — only the very first load, which `loading`'s
  // initial state already covers, needs the "Loading..." placeholder.
  const load = useCallback(() => {
    fetch("/api/collections")
      .then((res) => res.json())
      .then((data) => {
        if (data.errors?.length > 0) {
          setError(data.errors.join(" "));
        } else {
          setError(null);
          setCollections(data.collections ?? []);
          setSampleRefs(data.sampleRefs ?? []);
        }
      })
      .catch(() => setError("Couldn't reach the server."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6 sm:p-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Collections</h1>
          <p className="text-sm text-muted-foreground">
            External collections worth keeping track of — a museum&apos;s, a
            collaborator&apos;s, or anything else useful that isn&apos;t part of the main
            database.
          </p>
        </div>
        <CollectionDialog onSaved={load} trigger={<Button>Add collection</Button>} />
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Couldn&apos;t load collections: {error}. If you haven&apos;t already, run{" "}
          <code className="rounded bg-black/10 px-1">supabase/migrations/0004_collections.sql</code>{" "}
          in the Supabase SQL Editor.
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : collections.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No collections yet. Add one to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {collections.map((collection) => {
            const sampleCount = sampleRefs.filter(
              (r) => r.collection_id === collection.id
            ).length;
            return (
              <CollectionCard
                key={collection.id}
                collection={collection}
                sampleCount={sampleCount}
                onSaved={load}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
