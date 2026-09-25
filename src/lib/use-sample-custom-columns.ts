"use client";

import { useCallback, useEffect, useState } from "react";
import { SampleCustomColumn } from "./sample-custom-columns-store";

// The "Other: specify" custom fields on samples — global, not per-project,
// so this fetches the same list everywhere a sample is added, edited, or
// shown in a table. Callers reload() after adding/renaming/deleting one.
export function useSampleCustomColumns() {
  const [columns, setColumns] = useState<SampleCustomColumn[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    fetch("/api/samples/custom-columns")
      .then((res) => res.json())
      .then((data) => setColumns(data.columns ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  function addColumnLocally(column: SampleCustomColumn) {
    setColumns((prev) => [...prev, column]);
  }

  return { columns, loading, reload, addColumnLocally };
}
