"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  LabWorkflowCustomColumn,
  LabWorkflowCustomValue,
  LabWorkflowEntry,
  LabWorkflowStep,
} from "@/lib/lab-workflows-store";
import { SampleRecord } from "@/lib/samples-store";
import { EntryStatus, nextStatus, STATUS_DOT_CLASS, STATUS_LABELS } from "@/lib/lab-workflow-status";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PaintedCell = { step_id: string; sample_id: string; status: EntryStatus };

function cellKey(stepId: string, sampleId: string) {
  return `${stepId}:${sampleId}`;
}

// Rows = enrolled samples, columns = steps, each cell a colored status dot.
// Left-click cycles grey -> yellow -> green; right-click sets red (failed)
// directly; dragging the pointer across cells "paints" every cell it
// passes over with that same target status, in one gesture — the paint
// value is fixed at drag start, not recomputed per cell, so a drag always
// leaves a uniform result behind it. The whole drag is batched into one
// commit on release instead of one request per cell.
export function SimpleGrid({
  steps,
  samples,
  entries,
  customColumns,
  customValues,
  onCommit,
  onSaveCustomValue,
}: {
  steps: LabWorkflowStep[];
  samples: SampleRecord[];
  entries: LabWorkflowEntry[];
  // Free-text columns (extraction/library name, etc.) rendered between
  // Species and the step columns — a different shape than steps, so
  // tracked entirely separately rather than shoehorned into `entries`.
  customColumns: LabWorkflowCustomColumn[];
  customValues: LabWorkflowCustomValue[];
  onCommit: (cells: PaintedCell[]) => void;
  onSaveCustomValue: (columnId: string, sampleId: string, value: string) => void;
}) {
  const baseStatus = useMemo(() => {
    const map = new Map<string, EntryStatus>();
    for (const entry of entries) map.set(cellKey(entry.step_id, entry.sample_id), entry.status);
    return map;
  }, [entries]);

  const baseCustomValue = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of customValues) map.set(cellKey(v.column_id, v.sample_id), v.value ?? "");
    return map;
  }, [customValues]);

  // Same "local override, cleared once the parent's own state reflects the
  // save" approach as the status dots' drag-paint overrides below — the
  // parent updates its custom-values state synchronously in
  // onSaveCustomValue, so clearing the override immediately on blur never
  // causes a visible flicker back to the old value.
  const [customOverrides, setCustomOverrides] = useState<Map<string, string>>(new Map());

  function customValueFor(columnId: string, sampleId: string): string {
    const key = cellKey(columnId, sampleId);
    return customOverrides.get(key) ?? baseCustomValue.get(key) ?? "";
  }

  function handleCustomChange(columnId: string, sampleId: string, value: string) {
    setCustomOverrides((prev) => new Map(prev).set(cellKey(columnId, sampleId), value));
  }

  function handleCustomBlur(columnId: string, sampleId: string) {
    const key = cellKey(columnId, sampleId);
    const value = customOverrides.get(key);
    if (value === undefined) return;
    onSaveCustomValue(columnId, sampleId, value);
    setCustomOverrides((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }

  // Cells touched by the drag currently in progress, painted immediately
  // for feedback and cleared as soon as the parent's `entries` reflects
  // the committed result (see the onCommit caller's optimistic update).
  const [overrides, setOverrides] = useState<Map<string, EntryStatus>>(new Map());
  const paintingRef = useRef<{ value: EntryStatus; touched: Map<string, PaintedCell> } | null>(null);

  function statusFor(stepId: string, sampleId: string): EntryStatus {
    const key = cellKey(stepId, sampleId);
    return overrides.get(key) ?? baseStatus.get(key) ?? "not_started";
  }

  function paint(stepId: string, sampleId: string) {
    const painting = paintingRef.current;
    if (!painting) return;
    const key = cellKey(stepId, sampleId);
    if (painting.touched.has(key)) return;
    painting.touched.set(key, { step_id: stepId, sample_id: sampleId, status: painting.value });
    setOverrides((prev) => new Map(prev).set(key, painting.value));
  }

  function startPaint(stepId: string, sampleId: string, isRightClick: boolean) {
    const value: EntryStatus = isRightClick ? "failed" : nextStatus(statusFor(stepId, sampleId));
    paintingRef.current = { value, touched: new Map() };
    paint(stepId, sampleId);
  }

  function endPaint() {
    const painting = paintingRef.current;
    if (!painting) return;
    paintingRef.current = null;
    const cells = [...painting.touched.values()];
    if (cells.length > 0) onCommit(cells);
    setOverrides(new Map());
  }

  useEffect(() => {
    window.addEventListener("pointerup", endPaint);
    window.addEventListener("pointercancel", endPaint);
    return () => {
      window.removeEventListener("pointerup", endPaint);
      window.removeEventListener("pointercancel", endPaint);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (samples.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        No samples enrolled yet. Use &quot;Manage samples&quot; to add some.
      </div>
    );
  }

  return (
    <div className="select-none overflow-x-auto rounded-lg border border-border">
      <Table className="w-auto">
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 h-8 bg-card align-bottom">Sample ID</TableHead>
            <TableHead className="h-8 align-bottom">Species</TableHead>
            {customColumns.map((column) => (
              <TableHead key={column.id} className="h-8 min-w-32 align-bottom">
                {column.label}
              </TableHead>
            ))}
            {steps.map((step) => (
              <TableHead key={step.id} className="relative h-28 w-10 min-w-10 p-0 align-bottom">
                <span className="absolute bottom-2 left-1/2 origin-bottom-left -rotate-45 whitespace-nowrap text-xs font-medium">
                  {step.label}
                </span>
              </TableHead>
            ))}
            {/* Real trailing column, not just padding — an angled label
                needs actual layout width to its right to avoid being
                clipped by the scroll container, which CSS padding on the
                table doesn't reliably provide. */}
            <TableHead className="w-10 min-w-10 p-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {samples.map((sample) => (
            <TableRow key={sample.id}>
              <TableCell className="sticky left-0 z-10 bg-card py-1 font-mono">
                {sample.primary_identifier}
              </TableCell>
              <TableCell className="py-1 text-muted-foreground">{sample.species}</TableCell>
              {customColumns.map((column) => (
                <TableCell key={column.id} className="py-1">
                  <Input
                    className="h-7 min-w-28"
                    value={customValueFor(column.id, sample.id)}
                    onChange={(e) => handleCustomChange(column.id, sample.id, e.target.value)}
                    onBlur={() => handleCustomBlur(column.id, sample.id)}
                  />
                </TableCell>
              ))}
              {steps.map((step) => {
                const status = statusFor(step.id, sample.id);
                return (
                  <TableCell key={step.id} className="w-10 min-w-10 py-1 text-center">
                    <button
                      type="button"
                      title={STATUS_LABELS[status]}
                      aria-label={`${sample.primary_identifier} — ${step.label}: ${STATUS_LABELS[status]}`}
                      className="rounded-full p-1 hover:bg-accent"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        startPaint(step.id, sample.id, e.button === 2);
                      }}
                      onPointerEnter={() => paint(step.id, sample.id)}
                      onContextMenu={(e) => e.preventDefault()}
                    >
                      <span className={cn("block size-3.5 rounded-full", STATUS_DOT_CLASS[status])} />
                    </button>
                  </TableCell>
                );
              })}
              <TableCell className="w-10 min-w-10" />
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
