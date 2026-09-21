"use client";

import { useMemo, useState } from "react";
import { getVisibleColumns, FieldDef } from "@/lib/fields";
import { SampleRecord } from "@/lib/samples-store";
import { formatToDDMMYYYY } from "@/lib/dates";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

type SortState = { key: string; direction: "asc" | "desc" };

function compareValues(a: unknown, b: unknown, type: FieldDef["type"]): number {
  const aEmpty = a === undefined || a === "" || a === null;
  const bEmpty = b === undefined || b === "" || b === null;
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1; // empty values always sort last, regardless of direction
  if (bEmpty) return -1;

  if (type === "number") return Number(a) - Number(b);
  // Dates are stored as ISO (YYYY-MM-DD), which sorts correctly as a plain
  // string — no need to special-case it separately from text.
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

export function SampleTable({
  samples,
  visibleOptionalKeys,
  hiddenSampleIds,
  onToggleHidden,
  highlightedSampleId,
  onSelectSample,
}: {
  samples: SampleRecord[];
  visibleOptionalKeys: string[];
  // Samples unticked here are excluded from the map — the tick box sits to
  // the left of every other column.
  hiddenSampleIds: Set<string>;
  onToggleHidden: (id: string) => void;
  // Clicking anywhere on a row except the tick box highlights that sample
  // on the map; clicking the already-highlighted row clears it.
  highlightedSampleId: string | null;
  onSelectSample: (id: string) => void;
}) {
  const columns = getVisibleColumns(visibleOptionalKeys);
  const [sort, setSort] = useState<SortState | null>(null);

  const sortedSamples = useMemo(() => {
    if (!sort) return samples;
    const column = columns.find((c) => c.key === sort.key);
    if (!column) return samples;
    const sign = sort.direction === "asc" ? 1 : -1;
    return [...samples].sort(
      (a, b) => sign * compareValues(a[column.key], b[column.key], column.type)
    );
    // columns is derived fresh each render from visibleOptionalKeys, so it's
    // deliberately left out of the dependency list to avoid re-sorting on
    // every render — sort.key is enough to look the column back up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [samples, sort]);

  function toggleSort(key: string) {
    setSort((prev) => {
      if (prev?.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  }

  if (samples.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        No samples yet. Add one, or import a CSV, to get started.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-0">
              <span className="sr-only">Show on map</span>
            </TableHead>
            {columns.map((col) => (
              <TableHead key={col.key}>
                <button
                  type="button"
                  onClick={() => toggleSort(col.key)}
                  className="flex items-center gap-1 hover:text-foreground"
                >
                  {col.label}
                  <span className="w-3 text-[10px]">
                    {sort?.key === col.key ? (sort.direction === "asc" ? "▲" : "▼") : ""}
                  </span>
                </button>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedSamples.map((sample) => {
            const isHidden = hiddenSampleIds.has(sample.id);
            const isHighlighted = sample.id === highlightedSampleId;
            return (
              <TableRow
                key={sample.id}
                data-state={isHighlighted ? "selected" : undefined}
                onClick={() => onSelectSample(sample.id)}
                className="cursor-pointer"
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={!isHidden}
                    onCheckedChange={() => onToggleHidden(sample.id)}
                    aria-label={`Show ${sample.id} on the map`}
                  />
                </TableCell>
                {columns.map((col) => {
                  const value = sample[col.key];
                  if (value === undefined || value === "") {
                    return (
                      <TableCell key={col.key} className={cn(isHidden && "opacity-50")}>
                        <span className="text-muted-foreground">—</span>
                      </TableCell>
                    );
                  }
                  return (
                    <TableCell key={col.key} className={cn(isHidden && "opacity-50")}>
                      {col.type === "date"
                        ? formatToDDMMYYYY(String(value))
                        : String(value)}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
