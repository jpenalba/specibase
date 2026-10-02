"use client";

import { useCallback, useEffect, useState } from "react";
import { CollectionCustomColumn } from "./collection-custom-columns-store";

// The "Other: specify" custom fields on a collection's own samples — see
// use-sample-custom-columns.ts for the account/project equivalent. Always
// scoped to one collection (no account-wide variant), mirroring
// collection-custom-columns-store.ts's own single-scope shape.
export function useCollectionCustomColumns(collectionId: string) {
  const [columns, setColumns] = useState<CollectionCustomColumn[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    fetch(`/api/collections/${collectionId}/custom-columns`)
      .then((res) => res.json())
      .then((data) => setColumns(data.columns ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [collectionId]);

  useEffect(() => {
    reload();
  }, [reload]);

  function addColumnLocally(column: CollectionCustomColumn) {
    setColumns((prev) => [...prev, column]);
  }

  return { columns, loading, reload, addColumnLocally };
}
