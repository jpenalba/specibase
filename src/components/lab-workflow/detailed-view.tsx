"use client";

import { useState } from "react";
import { LabWorkflowEntry, LabWorkflowStep } from "@/lib/lab-workflows-store";
import { SampleRecord } from "@/lib/samples-store";
import { ALL_STATUSES, EntryStatus, STATUS_LABELS } from "@/lib/lab-workflow-status";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type DetailedEntryPatch = {
  status?: EntryStatus;
  method?: string | null;
  date?: string | null;
  performed_by?: string | null;
  quantification?: Record<string, unknown> | null;
  notes?: string | null;
};

type RowState = {
  status: EntryStatus;
  method: string;
  date: string;
  performed_by: string;
  // Quantification is a free-form jsonb column (what's worth measuring
  // differs per step) — this editor keeps it to a single text value
  // rather than a dynamic key/value builder, stored as {"value": "..."}.
  quantification: string;
  notes: string;
};

function rowFromEntry(entry: LabWorkflowEntry | undefined): RowState {
  return {
    status: entry?.status ?? "not_started",
    method: entry?.method ?? "",
    date: entry?.date ?? "",
    performed_by: entry?.performed_by ?? "",
    quantification: (entry?.quantification?.value as string | undefined) ?? "",
    notes: entry?.notes ?? "",
  };
}

// One step's worth of editable rows. Keyed by stepId from the parent, so
// switching steps remounts this (fresh local edit state per step) rather
// than needing an effect to re-sync local state when the prop changes.
function StepRows({
  stepId,
  samples,
  entries,
  onSaveEntry,
}: {
  stepId: string;
  samples: SampleRecord[];
  entries: LabWorkflowEntry[];
  onSaveEntry: (stepId: string, sampleId: string, patch: DetailedEntryPatch) => void;
}) {
  const [rows, setRows] = useState<Record<string, RowState>>(() => {
    const initial: Record<string, RowState> = {};
    for (const sample of samples) {
      const entry = entries.find((e) => e.step_id === stepId && e.sample_id === sample.id);
      initial[sample.id] = rowFromEntry(entry);
    }
    return initial;
  });

  function updateRow(sampleId: string, patch: Partial<RowState>) {
    setRows((prev) => ({
      ...prev,
      [sampleId]: { ...(prev[sampleId] ?? rowFromEntry(undefined)), ...patch },
    }));
  }

  function commit(sampleId: string, patch: DetailedEntryPatch) {
    onSaveEntry(stepId, sampleId, patch);
  }

  if (samples.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        No samples enrolled yet. Use &quot;Manage samples&quot; to add some.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 h-8 bg-card">Sample ID</TableHead>
            <TableHead className="h-8">Status</TableHead>
            <TableHead className="h-8">Method</TableHead>
            <TableHead className="h-8">Date</TableHead>
            <TableHead className="h-8">Performed by</TableHead>
            <TableHead className="h-8">Quantification</TableHead>
            <TableHead className="h-8">Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {samples.map((sample) => {
            const row = rows[sample.id] ?? rowFromEntry(undefined);
            return (
              <TableRow key={sample.id}>
                <TableCell className="sticky left-0 z-10 bg-card py-1 font-mono">
                  {sample.primary_identifier}
                </TableCell>
                <TableCell className="py-1">
                  <select
                    value={row.status}
                    onChange={(e) => {
                      const status = e.target.value as EntryStatus;
                      updateRow(sample.id, { status });
                      commit(sample.id, { status });
                    }}
                    className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                  >
                    {ALL_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </TableCell>
                <TableCell className="py-1">
                  <Input
                    className="h-8 min-w-32"
                    value={row.method}
                    onChange={(e) => updateRow(sample.id, { method: e.target.value })}
                    onBlur={() => commit(sample.id, { method: row.method || null })}
                  />
                </TableCell>
                <TableCell className="py-1">
                  <Input
                    type="date"
                    className="h-8"
                    value={row.date}
                    onChange={(e) => {
                      updateRow(sample.id, { date: e.target.value });
                      commit(sample.id, { date: e.target.value || null });
                    }}
                  />
                </TableCell>
                <TableCell className="py-1">
                  <Input
                    className="h-8 min-w-32"
                    value={row.performed_by}
                    onChange={(e) => updateRow(sample.id, { performed_by: e.target.value })}
                    onBlur={() => commit(sample.id, { performed_by: row.performed_by || null })}
                  />
                </TableCell>
                <TableCell className="py-1">
                  <Input
                    className="h-8 min-w-32"
                    placeholder="e.g. 45.2 ng/µL"
                    value={row.quantification}
                    onChange={(e) => updateRow(sample.id, { quantification: e.target.value })}
                    onBlur={() =>
                      commit(sample.id, {
                        quantification: row.quantification ? { value: row.quantification } : null,
                      })
                    }
                  />
                </TableCell>
                <TableCell className="py-1">
                  <Input
                    className="h-8 min-w-40"
                    value={row.notes}
                    onChange={(e) => updateRow(sample.id, { notes: e.target.value })}
                    onBlur={() => commit(sample.id, { notes: row.notes || null })}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// The step-at-a-time spreadsheet: pick a step via the tab row, then edit
// every enrolled sample's method/date/performed-by/quantification/notes
// for just that step. A per-sample field commits on blur (or immediately
// for the status dropdown and date picker) rather than needing an
// explicit save button per row.
export function DetailedView({
  steps,
  samples,
  entries,
  onSaveEntry,
}: {
  steps: LabWorkflowStep[];
  samples: SampleRecord[];
  entries: LabWorkflowEntry[];
  onSaveEntry: (stepId: string, sampleId: string, patch: DetailedEntryPatch) => void;
}) {
  const [selectedStepId, setSelectedStepId] = useState<string | undefined>(undefined);
  const activeStepId = selectedStepId ?? steps[0]?.id;

  if (steps.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        No steps yet.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-1.5 border-b border-border pb-3">
        {steps.map((step) => (
          <button
            key={step.id}
            type="button"
            onClick={() => setSelectedStepId(step.id)}
            className={cn(
              "rounded-full px-3 py-1 text-sm",
              activeStepId === step.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {step.label}
          </button>
        ))}
      </div>

      {activeStepId && (
        <StepRows
          key={activeStepId}
          stepId={activeStepId}
          samples={samples}
          entries={entries}
          onSaveEntry={onSaveEntry}
        />
      )}
    </div>
  );
}
