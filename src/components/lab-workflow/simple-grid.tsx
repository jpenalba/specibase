"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LabWorkflowEntry, LabWorkflowStep } from "@/lib/lab-workflows-store";
import { SampleRecord } from "@/lib/samples-store";
import { EntryStatus, nextStatus, STATUS_DOT_CLASS, STATUS_LABELS } from "@/lib/lab-workflow-status";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
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
  onCommit,
}: {
  steps: LabWorkflowStep[];
  samples: SampleRecord[];
  entries: LabWorkflowEntry[];
  onCommit: (cells: PaintedCell[]) => void;
}) {
  const baseStatus = useMemo(() => {
    const map = new Map<string, EntryStatus>();
    for (const entry of entries) map.set(cellKey(entry.step_id, entry.sample_id), entry.status);
    return map;
  }, [entries]);

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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 h-8 bg-card">Sample ID</TableHead>
            <TableHead className="h-8">Species</TableHead>
            {steps.map((step) => (
              <TableHead key={step.id} className="h-8 text-center">
                {step.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {samples.map((sample) => (
            <TableRow key={sample.id}>
              <TableCell className="sticky left-0 z-10 bg-card py-1 font-mono">
                {sample.primary_identifier}
              </TableCell>
              <TableCell className="py-1 text-muted-foreground">{sample.species}</TableCell>
              {steps.map((step) => {
                const status = statusFor(step.id, sample.id);
                return (
                  <TableCell key={step.id} className="py-1 text-center">
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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
