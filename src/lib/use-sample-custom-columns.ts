"use client";

import { useCallback, useEffect, useState } from "react";
import { SampleCustomColumn } from "./sample-custom-columns-store";

// The "Other: specify" custom fields on samples — fetches every column the
// account has when called with no projectId (the plain Database page), or
// just that project's own when called with one (a project's Samples tab).
// See sample-custom-columns-store.ts's listCustomColumns for the scoping
// rules. Callers reload() after adding/renaming/deleting one.
export function useSampleCustomColumns(projectId?: string) {
  const [columns, setColumns] = useState<SampleCustomColumn[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    const url = projectId
      ? `/api/samples/custom-columns?projectId=${projectId}`
      : "/api/samples/custom-columns";
    fetch(url)
      .then((res) => res.json())
      .then((data) => setColumns(data.columns ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    reload();
  }, [reload]);

  function addColumnLocally(column: SampleCustomColumn) {
    setColumns((prev) => [...prev, column]);
  }

  return { columns, loading, reload, addColumnLocally };
}
