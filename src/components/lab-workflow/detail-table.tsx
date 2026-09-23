"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { LabWorkflowDetailColumn, LabWorkflowDetailValue } from "@/lib/lab-workflows-store";
import { SampleRecord } from "@/lib/samples-store";
import { ALL_STATUSES, EntryStatus, STATUS_LABELS } from "@/lib/lab-workflow-status";
import { incrementSeriesValue } from "@/lib/series-fill";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DetailValueEntry = { sampleId: string; value: string };

function cellKey(columnId: string, sampleId: string) {
  return `${columnId}:${sampleId}`;
}

// A workflow's single Detailed-view spreadsheet: one row per enrolled
// sample, one column per detail column (Status plus whatever's been added
// via Manage detail columns) — there's no more picking a step first, since
// these columns aren't tied to steps at all. Locked outside Editing mode,
// same as the Simple grid.
export function DetailTable({
  samples,
  columns,
  values,
  editable,
  onSaveDetailValues,
}: {
  samples: SampleRecord[];
  columns: LabWorkflowDetailColumn[];
  values: LabWorkflowDetailValue[];
  editable: boolean;
  onSaveDetailValues: (columnId: string, entries: DetailValueEntry[]) => void;
}) {
  const baseValue = new Map<string, string>();
  for (const v of values) baseValue.set(cellKey(v.column_id, v.sample_id), v.value ?? "");

  const [overrides, setOverrides] = useState<Map<string, string>>(new Map());

  function valueFor(columnId: string, sampleId: string, kind: LabWorkflowDetailColumn["kind"]): string {
    const key = cellKey(columnId, sampleId);
    const value = overrides.get(key) ?? baseValue.get(key) ?? "";
    if (kind === "status") return value || "not_started";
    return value;
  }

  function handleChange(columnId: string, sampleId: string, value: string) {
    setOverrides((prev) => new Map(prev).set(cellKey(columnId, sampleId), value));
  }

  function handleBlur(columnId: string, sampleId: string) {
    const key = cellKey(columnId, sampleId);
    const value = overrides.get(key);
    if (value === undefined) return;
    onSaveDetailValues(columnId, [{ sampleId, value }]);
    setOverrides((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }

  function handleStatusChange(columnId: string, sampleId: string, value: string) {
    onSaveDetailValues(columnId, [{ sampleId, value }]);
  }

  // Fill handle, same drag-a-corner mechanic as the Simple grid's custom
  // columns — except the drag doesn't commit anything on release. Instead
  // it stages a pending fill and asks whether to continue the source
  // value's series or just copy it down, since a Detailed-view column
  // could reasonably be either (a plate name repeats; a well index climbs).
  const [pendingFill, setPendingFill] = useState<{
    columnId: string;
    sourceIndex: number;
    targetIndex: number;
    sourceValue: string;
  } | null>(null);
  const [fillPreview, setFillPreview] = useState<{ columnId: string; from: number; to: number } | null>(
    null
  );
  const fillDragRef = useRef<{
    columnId: string;
    sourceIndex: number;
    currentIndex: number;
    sourceValue: string;
  } | null>(null);

  function startFillDrag(columnId: string, sourceIndex: number, kind: LabWorkflowDetailColumn["kind"]) {
    const sourceValue = valueFor(columnId, samples[sourceIndex].id, kind);
    const drag = { columnId, sourceIndex, currentIndex: sourceIndex, sourceValue };
    fillDragRef.current = drag;
    setFillPreview({ columnId, from: sourceIndex, to: sourceIndex });

    function finish() {
      fillDragRef.current = null;
      setFillPreview(null);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      if (drag.currentIndex === drag.sourceIndex) return;
      setPendingFill({
        columnId,
        sourceIndex: drag.sourceIndex,
        targetIndex: drag.currentIndex,
        sourceValue: drag.sourceValue,
      });
    }

    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  }

  function updateFillDrag(columnId: string, index: number) {
    const drag = fillDragRef.current;
    if (!drag || drag.columnId !== columnId) return;
    drag.currentIndex = index;
    setFillPreview({ columnId, from: Math.min(drag.sourceIndex, index), to: Math.max(drag.sourceIndex, index) });
  }

  function applyPendingFill(mode: "series" | "copy") {
    if (!pendingFill) return;
    const { columnId, sourceIndex, targetIndex, sourceValue } = pendingFill;
    const step = targetIndex > sourceIndex ? 1 : -1;
    const entries: DetailValueEntry[] = [];
    for (let i = sourceIndex + step; step > 0 ? i <= targetIndex : i >= targetIndex; i += step) {
      entries.push({
        sampleId: samples[i].id,
        value: mode === "series" ? incrementSeriesValue(sourceValue, i - sourceIndex) : sourceValue,
      });
    }
    onSaveDetailValues(columnId, entries);
    setPendingFill(null);
  }

  if (samples.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        No samples enrolled yet. Use &quot;Manage samples&quot; to add some.
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {pendingFill && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-input bg-accent/50 px-3 py-2 text-sm">
          <span>
            Fill {Math.abs(pendingFill.targetIndex - pendingFill.sourceIndex)} cell
            {Math.abs(pendingFill.targetIndex - pendingFill.sourceIndex) === 1 ? "" : "s"}:
          </span>
          <Button type="button" size="sm" variant="outline" onClick={() => applyPendingFill("series")}>
            Fill series
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => applyPendingFill("copy")}>
            Copy value
          </Button>
          <button
            type="button"
            onClick={() => setPendingFill(null)}
            className="ml-auto rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Cancel fill"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="select-none overflow-x-auto rounded-lg border border-border">
        <Table className="w-auto">
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 h-8 bg-card">Sample ID</TableHead>
              {columns.map((column) => (
                <TableHead key={column.id} className="h-8 min-w-32">
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {samples.map((sample, sampleIndex) => (
              <TableRow key={sample.id}>
                <TableCell className="sticky left-0 z-10 bg-card py-1 font-mono">
                  {sample.primary_identifier}
                </TableCell>
                {columns.map((column) => {
                  const value = valueFor(column.id, sample.id, column.kind);
                  const inFillRange =
                    fillPreview?.columnId === column.id &&
                    sampleIndex >= fillPreview.from &&
                    sampleIndex <= fillPreview.to;

                  if (!editable) {
                    return (
                      <TableCell key={column.id} className="py-1">
                        {column.kind === "status" ? STATUS_LABELS[value as EntryStatus] : value}
                      </TableCell>
                    );
                  }

                  return (
                    <TableCell key={column.id} className="py-1">
                      <div
                        className={cn(
                          "group relative rounded-sm",
                          inFillRange && "outline outline-2 outline-offset-1 outline-primary"
                        )}
                        onPointerEnter={() => updateFillDrag(column.id, sampleIndex)}
                      >
                        {column.kind === "status" ? (
                          <select
                            value={value}
                            onChange={(e) => handleStatusChange(column.id, sample.id, e.target.value)}
                            className="h-7 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                          >
                            {ALL_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {STATUS_LABELS[status]}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Input
                            type={column.kind === "date" ? "date" : "text"}
                            className="h-7 min-w-28"
                            value={value}
                            onChange={(e) => handleChange(column.id, sample.id, e.target.value)}
                            onBlur={() => handleBlur(column.id, sample.id)}
                          />
                        )}
                        <div
                          role="presentation"
                          aria-hidden
                          className="absolute -bottom-1 -right-1 size-2.5 cursor-crosshair rounded-[2px] border border-card bg-primary opacity-0 group-hover:opacity-100"
                          style={{ touchAction: "none" }}
                          onPointerDown={(e) => {
                            e.preventDefault();
                            startFillDrag(column.id, sampleIndex, column.kind);
                          }}
                        />
                      </div>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
