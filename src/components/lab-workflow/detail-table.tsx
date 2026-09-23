"use client";

import { useMemo, useRef, useState } from "react";
import { Copy, RotateCcw, Trash2, X } from "lucide-react";
import { LabWorkflowDetailColumn, LabWorkflowDetailRow, LabWorkflowDetailValue } from "@/lib/lab-workflows-store";
import { SampleRecord } from "@/lib/samples-store";
import { ALL_STATUSES, EntryStatus, STATUS_BADGE_CLASS, STATUS_LABELS } from "@/lib/lab-workflow-status";
import { incrementSeriesValue } from "@/lib/series-fill";
import { formatDateDMY } from "@/lib/date-format";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DetailValueEntry = { rowId: string; value: string };
type DisplayRow = { sample: SampleRecord; row: LabWorkflowDetailRow };

function cellKey(columnId: string, rowId: string) {
  return `${columnId}:${rowId}`;
}

// A workflow's single Detailed-view spreadsheet: one line per row (an
// attempt at a sample — normally one, or more if a sample was redone), one
// column per detail column (Status plus whatever's been added via Manage
// detail columns). Locked outside Editing mode, same as the Simple grid.
export function DetailTable({
  samples,
  rows,
  columns,
  values,
  editable,
  onSaveDetailValues,
  onDuplicateRow,
  onDeleteRow,
}: {
  samples: SampleRecord[];
  rows: LabWorkflowDetailRow[];
  columns: LabWorkflowDetailColumn[];
  values: LabWorkflowDetailValue[];
  editable: boolean;
  onSaveDetailValues: (columnId: string, entries: DetailValueEntry[]) => void;
  onDuplicateRow: (row: LabWorkflowDetailRow) => void;
  onDeleteRow: (row: LabWorkflowDetailRow) => void;
}) {
  // One line per row, not per sample — a sample with a redo appears twice
  // (or more), grouped together and ordered by attempt number, in the same
  // sample order the caller already paginated/sorted.
  const displayRows = useMemo(() => {
    const rowsBySample = new Map<string, LabWorkflowDetailRow[]>();
    for (const row of rows) {
      const list = rowsBySample.get(row.sample_id) ?? [];
      list.push(row);
      rowsBySample.set(row.sample_id, list);
    }
    for (const list of rowsBySample.values()) list.sort((a, b) => a.attempt_number - b.attempt_number);

    const result: DisplayRow[] = [];
    for (const sample of samples) {
      for (const row of rowsBySample.get(sample.id) ?? []) result.push({ sample, row });
    }
    return result;
  }, [samples, rows]);

  const baseValue = new Map<string, string>();
  for (const v of values) baseValue.set(cellKey(v.column_id, v.row_id), v.value ?? "");

  const [overrides, setOverrides] = useState<Map<string, string>>(new Map());

  function valueFor(columnId: string, rowId: string, kind: LabWorkflowDetailColumn["kind"]): string {
    const key = cellKey(columnId, rowId);
    const value = overrides.get(key) ?? baseValue.get(key) ?? "";
    if (kind === "status") return value || "not_started";
    return value;
  }

  function handleChange(columnId: string, rowId: string, value: string) {
    setOverrides((prev) => new Map(prev).set(cellKey(columnId, rowId), value));
  }

  function handleBlur(columnId: string, rowId: string) {
    const key = cellKey(columnId, rowId);
    const value = overrides.get(key);
    if (value === undefined) return;
    onSaveDetailValues(columnId, [{ rowId, value }]);
    setOverrides((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }

  function handleStatusChange(columnId: string, rowId: string, value: string) {
    onSaveDetailValues(columnId, [{ rowId, value }]);
  }

  // Fill handle, same drag-a-corner mechanic as the Simple grid's custom
  // columns — except the drag doesn't commit anything on release. Instead
  // it stages a pending fill and shows a floating choice, near wherever the
  // pointer was released, of whether to continue the source value's series
  // or just copy it down, since a Detailed-view column could reasonably be
  // either (a plate name repeats; a well index climbs).
  const [pendingFill, setPendingFill] = useState<{
    columnId: string;
    sourceIndex: number;
    targetIndex: number;
    sourceValue: string;
    x: number;
    y: number;
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
    const sourceValue = valueFor(columnId, displayRows[sourceIndex].row.id, kind);
    const drag = { columnId, sourceIndex, currentIndex: sourceIndex, sourceValue };
    fillDragRef.current = drag;
    setFillPreview({ columnId, from: sourceIndex, to: sourceIndex });

    function finish(e: PointerEvent) {
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
        x: e.clientX,
        y: e.clientY,
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
        rowId: displayRows[i].row.id,
        value: mode === "series" ? incrementSeriesValue(sourceValue, i - sourceIndex) : sourceValue,
      });
    }
    onSaveDetailValues(columnId, entries);
    setPendingFill(null);
  }

  if (displayRows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        No samples enrolled yet. Use &quot;Manage samples&quot; to add some.
      </div>
    );
  }

  const fillCount = pendingFill ? Math.abs(pendingFill.targetIndex - pendingFill.sourceIndex) : 0;
  // Rough popup footprint, clamped inside the viewport so it never renders
  // partly off-screen near an edge or corner.
  const POPUP_WIDTH = 280;
  const POPUP_HEIGHT = 46;
  const popupLeft = pendingFill
    ? Math.min(Math.max(8, pendingFill.x - POPUP_WIDTH / 2), window.innerWidth - POPUP_WIDTH - 8)
    : 0;
  const popupTop = pendingFill
    ? Math.min(pendingFill.y + 16, window.innerHeight - POPUP_HEIGHT - 8)
    : 0;

  return (
    <div className="grid gap-2">
      {pendingFill && (
        <div
          className="fixed z-50 flex flex-wrap items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-sm shadow-md"
          style={{ left: popupLeft, top: popupTop, width: POPUP_WIDTH }}
        >
          <span className="text-xs text-muted-foreground">
            Fill {fillCount} cell{fillCount === 1 ? "" : "s"}:
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
              {editable && <TableHead className="h-8 w-16" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayRows.map(({ sample, row }, rowIndex) => {
              const isRedo = row.attempt_number > 1;
              return (
                <TableRow key={row.id} className={cn(isRedo && "bg-muted/20")}>
                  <TableCell
                    className={cn("sticky left-0 z-10 bg-card py-1", isRedo ? "pl-5" : "font-mono")}
                  >
                    {isRedo ? (
                      <span
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
                        title={`Redo of ${sample.primary_identifier}`}
                      >
                        <RotateCcw className="size-3" />
                        Redo of {sample.primary_identifier}
                      </span>
                    ) : (
                      sample.primary_identifier
                    )}
                  </TableCell>
                  {columns.map((column) => {
                    const value = valueFor(column.id, row.id, column.kind);
                    const inFillRange =
                      fillPreview?.columnId === column.id &&
                      rowIndex >= fillPreview.from &&
                      rowIndex <= fillPreview.to;

                    if (!editable) {
                      return (
                        <TableCell key={column.id} className="py-1">
                          {column.kind === "status" ? (
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-xs font-medium",
                                STATUS_BADGE_CLASS[value as EntryStatus]
                              )}
                            >
                              {STATUS_LABELS[value as EntryStatus]}
                            </span>
                          ) : column.kind === "date" ? (
                            formatDateDMY(value)
                          ) : (
                            value
                          )}
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
                          onPointerEnter={() => updateFillDrag(column.id, rowIndex)}
                        >
                          {column.kind === "status" ? (
                            <select
                              value={value}
                              onChange={(e) => handleStatusChange(column.id, row.id, e.target.value)}
                              className={cn(
                                "h-7 w-full rounded-md border-0 px-2 text-sm font-medium",
                                STATUS_BADGE_CLASS[value as EntryStatus]
                              )}
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
                              onChange={(e) => handleChange(column.id, row.id, e.target.value)}
                              onBlur={() => handleBlur(column.id, row.id)}
                            />
                          )}
                          <div
                            role="presentation"
                            aria-hidden
                            className="absolute -bottom-1 -right-1 size-2.5 cursor-crosshair rounded-[2px] border border-card bg-primary opacity-0 group-hover:opacity-100"
                            style={{ touchAction: "none" }}
                            onPointerDown={(e) => {
                              e.preventDefault();
                              startFillDrag(column.id, rowIndex, column.kind);
                            }}
                          />
                        </div>
                      </TableCell>
                    );
                  })}
                  {editable && (
                    <TableCell className="py-1">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onDuplicateRow(row)}
                          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                          aria-label={`Duplicate ${sample.primary_identifier}`}
                          title="Duplicate row (redo)"
                        >
                          <Copy className="size-4" />
                        </button>
                        {isRedo && (
                          <button
                            type="button"
                            onClick={() => onDeleteRow(row)}
                            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            aria-label={`Remove redo row for ${sample.primary_identifier}`}
                            title="Remove this redo"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
